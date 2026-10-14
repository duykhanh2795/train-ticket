package kafka

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	bookingapp "example.com/train-ticket/internal/booking/application"
	kafkago "github.com/segmentio/kafka-go"
)

type Publisher struct {
	writer *kafkago.Writer
}

var _ bookingapp.EventPublisher = (*Publisher)(nil)

func NewPublisher(brokers []string, topic string) (*Publisher, error) {
	cleanBrokers := make([]string, 0, len(brokers))
	for _, broker := range brokers {
		if broker = strings.TrimSpace(broker); broker != "" {
			cleanBrokers = append(cleanBrokers, broker)
		}
	}
	if len(cleanBrokers) == 0 {
		return nil, errors.New("at least one Kafka broker is required")
	}
	if strings.TrimSpace(topic) == "" {
		return nil, errors.New("Kafka topic is required")
	}
	return &Publisher{writer: &kafkago.Writer{
		Addr:         kafkago.TCP(cleanBrokers...),
		Topic:        topic,
		Balancer:     &kafkago.Hash{},
		RequiredAcks: kafkago.RequireAll,
		Async:        false,
		BatchTimeout: 10 * time.Millisecond,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		MaxAttempts:  3,
	}}, nil
}

func (p *Publisher) Publish(ctx context.Context, message bookingapp.OutboxMessage) error {
	if p == nil || p.writer == nil {
		return errors.New("Kafka publisher is not initialized")
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := p.writer.WriteMessages(ctx, kafkago.Message{
		Key:   []byte(message.AggregateID),
		Value: message.Payload,
		Time:  message.OccurredAt,
		Headers: []kafkago.Header{
			{Key: "event_id", Value: []byte(message.ID)},
			{Key: "event_type", Value: []byte(message.EventType)},
		},
	}); err != nil {
		return fmt.Errorf("write Kafka event %q: %w", message.ID, err)
	}
	return nil
}

func (p *Publisher) Close() error {
	if p == nil || p.writer == nil {
		return nil
	}
	if err := p.writer.Close(); err != nil {
		return fmt.Errorf("close Kafka writer: %w", err)
	}
	return nil
}
