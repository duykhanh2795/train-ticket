package kafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	notificationapp "example.com/train-ticket/internal/notification/application"
	"example.com/train-ticket/internal/platform/observability"
	kafkago "github.com/segmentio/kafka-go"
)

type Receiver interface {
	Execute(context.Context, notificationapp.BookingEvent) (bool, error)
}
type messageReader interface {
	FetchMessage(context.Context) (kafkago.Message, error)
	CommitMessages(context.Context, ...kafkago.Message) error
	Close() error
}
type Consumer struct {
	reader   messageReader
	receiver Receiver
	logger   *slog.Logger
	metrics  *observability.WorkerMetrics
}

func NewConsumer(brokers []string, topic, group string, receiver Receiver, logger *slog.Logger, metrics *observability.WorkerMetrics) (*Consumer, error) {
	if len(brokers) == 0 || topic == "" || group == "" || receiver == nil || logger == nil || metrics == nil {
		return nil, errors.New("invalid notification consumer dependencies")
	}
	return &Consumer{reader: kafkago.NewReader(kafkago.ReaderConfig{
		Brokers: brokers, Topic: topic, GroupID: group, CommitInterval: 0, StartOffset: kafkago.FirstOffset, MaxBytes: 1 << 20,
	}), receiver: receiver, logger: logger, metrics: metrics}, nil
}

func (c *Consumer) Run(ctx context.Context) error {
	for ctx.Err() == nil {
		message, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			c.metrics.ConsumerFailures.Inc()
			c.logger.Error("fetch notification event", "error", err)
			if !pause(ctx) {
				return nil
			}
			continue
		}
		var event notificationapp.BookingEvent
		if err := json.Unmarshal(message.Value, &event); err != nil {
			c.metrics.ConsumerFailures.Inc()
			return fmt.Errorf("invalid event at partition %d offset %d; offset not committed: %w", message.Partition, message.Offset, err)
		}
		for ctx.Err() == nil {
			accepted, err := c.receiver.Execute(ctx, event)
			if errors.Is(err, notificationapp.ErrInvalidEvent) {
				c.metrics.ConsumerFailures.Inc()
				return fmt.Errorf("invalid event at partition %d offset %d; offset not committed: %w", message.Partition, message.Offset, err)
			}
			if err != nil {
				c.metrics.ConsumerFailures.Inc()
				c.logger.Error("process notification event", "event_id", event.EventID, "error", err)
				if !pause(ctx) {
					return nil
				}
				continue
			}
			result := "accepted"
			if !accepted {
				result = "duplicate"
			}
			c.metrics.Inbox.WithLabelValues(result).Inc()
			// Retry this offset before fetching another message: committing a later
			// offset in the same partition also commits all earlier offsets.
			for ctx.Err() == nil {
				if err := c.reader.CommitMessages(ctx, message); err == nil {
					break
				} else {
					c.metrics.ConsumerFailures.Inc()
					c.logger.Error("commit notification offset", "event_id", event.EventID, "error", err)
					if !pause(ctx) {
						return nil
					}
				}
			}
			break
		}
	}
	return nil
}

func (c *Consumer) Close() error { return c.reader.Close() }
func pause(ctx context.Context) bool {
	timer := time.NewTimer(time.Second)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
