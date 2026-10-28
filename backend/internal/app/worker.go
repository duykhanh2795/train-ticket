package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	bookingkafka "example.com/train-ticket/internal/booking/adapters/outbound/kafka"
	bookingpostgres "example.com/train-ticket/internal/booking/adapters/outbound/postgres"
	bookingapp "example.com/train-ticket/internal/booking/application"
	"example.com/train-ticket/internal/config"
	notificationkafka "example.com/train-ticket/internal/notification/adapters/inbound/kafka"
	notificationemail "example.com/train-ticket/internal/notification/adapters/outbound/email"
	notificationpostgres "example.com/train-ticket/internal/notification/adapters/outbound/postgres"
	notificationapp "example.com/train-ticket/internal/notification/application"
	platformclock "example.com/train-ticket/internal/platform/clock"
	"example.com/train-ticket/internal/platform/observability"
	"github.com/jackc/pgx/v5/pgxpool"
)

type batchRunner interface {
	RunOnce(context.Context) (int, error)
}
type Worker struct {
	logger         *slog.Logger
	expiry         batchRunner
	outbox         batchRunner
	stats          *bookingpostgres.OutboxRepository
	publisher      *bookingkafka.Publisher
	consumer       *notificationkafka.Consumer
	delivery       batchRunner
	metrics        *observability.WorkerMetrics
	metricsAddress string
}

type measuredPublisher struct {
	publisher bookingapp.EventPublisher
	metrics   *observability.WorkerMetrics
}

func (p measuredPublisher) Publish(ctx context.Context, message bookingapp.OutboxMessage) error {
	err := p.publisher.Publish(ctx, message)
	if err != nil {
		p.metrics.PublishFailures.Inc()
	} else {
		p.metrics.Published.Inc()
		p.metrics.EventAge.Observe(time.Since(message.OccurredAt).Seconds())
	}
	return err
}

func NewWorker(cfg config.Config, logger *slog.Logger, pool *pgxpool.Pool) (*Worker, error) {
	if logger == nil || strings.TrimSpace(cfg.WorkerMetricsAddress) == "" {
		return nil, errors.New("worker logger and metrics address are required")
	}
	booking, err := NewBookingModule(cfg, pool)
	if err != nil {
		return nil, err
	}
	stats, err := bookingpostgres.NewOutboxRepository(pool)
	if err != nil {
		return nil, err
	}
	inbox, err := notificationpostgres.NewInboxRepository(pool)
	if err != nil {
		return nil, err
	}
	receiver, err := notificationapp.NewReceiveBookingEvent(inbox, cfg.KafkaConsumerGroup)
	if err != nil {
		return nil, err
	}
	var delivery batchRunner
	if cfg.SMTPHost != "" {
		repository, err := notificationpostgres.NewDeliveryRepository(pool)
		if err != nil {
			return nil, err
		}
		sender, err := notificationemail.NewSMTPSender(notificationemail.SMTPConfig{
			Host: cfg.SMTPHost, Port: cfg.SMTPPort, Mode: cfg.SMTPMode,
			Username: cfg.SMTPUsername, Password: cfg.SMTPPassword, From: cfg.SMTPFrom,
		})
		if err != nil {
			return nil, err
		}
		delivery, err = notificationapp.NewDeliverEmail(repository, sender, platformclock.SystemClock{}, cfg.PublicAppURL)
		if err != nil {
			return nil, err
		}
	}
	publisher, err := bookingkafka.NewPublisher(cfg.KafkaBrokers, cfg.KafkaTopic)
	if err != nil {
		return nil, err
	}
	metrics := observability.NewWorkerMetrics()
	outbox, err := NewOutboxDispatcher(pool, measuredPublisher{publisher: publisher, metrics: metrics})
	if err != nil {
		_ = publisher.Close()
		return nil, err
	}
	consumer, err := notificationkafka.NewConsumer(cfg.KafkaBrokers, cfg.KafkaTopic, cfg.KafkaConsumerGroup, receiver, logger, metrics)
	if err != nil {
		_ = publisher.Close()
		return nil, err
	}
	return &Worker{logger: logger, expiry: booking.ExpireHolds, outbox: outbox, delivery: delivery, stats: stats, publisher: publisher, consumer: consumer, metrics: metrics, metricsAddress: cfg.WorkerMetricsAddress}, nil
}

func (w *Worker) Run(parent context.Context) error {
	listener, err := net.Listen("tcp", w.metricsAddress)
	if err != nil {
		return fmt.Errorf("listen for worker metrics: %w", err)
	}
	ctx, cancel := context.WithCancel(parent)
	defer cancel()
	mux := http.NewServeMux()
	mux.Handle("GET /metrics", w.metrics.Handler())
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	failures := make(chan error, 2)
	var wg sync.WaitGroup
	launch := func(fn func()) { wg.Add(1); go func() { defer wg.Done(); fn() }() }
	launch(func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			failures <- err
		}
	})
	launch(func() {
		if err := w.consumer.Run(ctx); err != nil {
			failures <- err
		}
	})
	launch(func() { w.runBatchLoop(ctx, "expiry", w.expiry, 5*time.Second) })
	launch(func() { w.runBatchLoop(ctx, "outbox", w.outbox, 2*time.Second) })
	if w.delivery != nil {
		launch(func() { w.runBatchLoop(ctx, "email", w.delivery, 5*time.Second) })
	}
	launch(func() { w.runStatsLoop(ctx) })
	w.logger.Info("background worker started", "metrics_address", w.metricsAddress)
	var runErr error
	select {
	case <-parent.Done():
	case runErr = <-failures:
	}
	cancel()
	shutdownCtx, stop := context.WithTimeout(context.WithoutCancel(parent), 5*time.Second)
	shutdownErr := server.Shutdown(shutdownCtx)
	stop()
	wg.Wait()
	return errors.Join(runErr, shutdownErr)
}

func (w *Worker) Close() error { return errors.Join(w.consumer.Close(), w.publisher.Close()) }

func (w *Worker) runBatchLoop(ctx context.Context, task string, runner batchRunner, interval time.Duration) {
	run := func() {
		started := time.Now()
		count := 0
		var err error
		iterations := 1
		if task == "outbox" || task == "email" {
			iterations = 100
		}
		// Drain a bounded number of events without claiming an entire batch's
		// leases before publication. Stop on an empty queue or first failure.
		for i := 0; i < iterations && ctx.Err() == nil; i++ {
			var completed int
			completed, err = runner.RunOnce(ctx)
			count += completed
			if err != nil || completed == 0 {
				break
			}
		}
		w.metrics.BatchDuration.WithLabelValues(task).Observe(time.Since(started).Seconds())
		w.metrics.BatchItems.WithLabelValues(task).Add(float64(count))
		if err != nil && ctx.Err() == nil {
			w.metrics.BatchFailures.WithLabelValues(task).Inc()
			w.logger.Error("background batch failed", "task", task, "error", err)
		}
	}
	run()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

func (w *Worker) runStatsLoop(ctx context.Context) {
	sample := func() {
		sampleCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		pending, age, err := w.stats.Stats(sampleCtx)
		if err != nil {
			if ctx.Err() == nil {
				w.metrics.StatsFailures.Inc()
				w.logger.Error("read outbox statistics", "error", err)
			}
			return
		}
		w.metrics.Pending.Set(float64(pending))
		w.metrics.OldestAge.Set(age)
	}
	sample()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sample()
		}
	}
}
