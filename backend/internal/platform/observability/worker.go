package observability

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
)

type WorkerMetrics struct {
	registry         *prometheus.Registry
	BatchItems       *prometheus.CounterVec
	BatchFailures    *prometheus.CounterVec
	BatchDuration    *prometheus.HistogramVec
	Published        prometheus.Counter
	PublishFailures  prometheus.Counter
	EventAge         prometheus.Histogram
	Inbox            *prometheus.CounterVec
	ConsumerFailures prometheus.Counter
	Pending          prometheus.Gauge
	OldestAge        prometheus.Gauge
	StatsFailures    prometheus.Counter
}

func NewWorkerMetrics() *WorkerMetrics {
	m := &WorkerMetrics{
		registry:         prometheus.NewRegistry(),
		BatchItems:       prometheus.NewCounterVec(prometheus.CounterOpts{Name: "worker_batch_items_total", Help: "Completed items by background task."}, []string{"task"}),
		BatchFailures:    prometheus.NewCounterVec(prometheus.CounterOpts{Name: "worker_batch_failures_total", Help: "Failed batch runs."}, []string{"task"}),
		BatchDuration:    prometheus.NewHistogramVec(prometheus.HistogramOpts{Name: "worker_batch_duration_seconds", Help: "Duration of batch runs."}, []string{"task"}),
		Published:        prometheus.NewCounter(prometheus.CounterOpts{Name: "booking_events_published_total", Help: "Events accepted by Kafka, including redeliveries."}),
		PublishFailures:  prometheus.NewCounter(prometheus.CounterOpts{Name: "booking_event_publish_failures_total", Help: "Kafka publish failures."}),
		EventAge:         prometheus.NewHistogram(prometheus.HistogramOpts{Name: "booking_event_publish_age_seconds", Help: "Event age when accepted by Kafka.", Buckets: []float64{1, 5, 10, 30, 60, 300, 3600}}),
		Inbox:            prometheus.NewCounterVec(prometheus.CounterOpts{Name: "notification_inbox_events_total", Help: "Inbox results."}, []string{"result"}),
		ConsumerFailures: prometheus.NewCounter(prometheus.CounterOpts{Name: "notification_consumer_failures_total", Help: "Fetch, process, or offset commit failures."}),
		Pending:          prometheus.NewGauge(prometheus.GaugeOpts{Name: "booking_outbox_pending", Help: "Unpublished outbox rows."}),
		OldestAge:        prometheus.NewGauge(prometheus.GaugeOpts{Name: "booking_outbox_oldest_age_seconds", Help: "Age of the oldest pending event."}),
		StatsFailures:    prometheus.NewCounter(prometheus.CounterOpts{Name: "booking_outbox_stats_failures_total", Help: "Failed outbox stats queries."}),
	}
	m.registry.MustRegister(collectors.NewGoCollector(), collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
		m.BatchItems, m.BatchFailures, m.BatchDuration, m.Published, m.PublishFailures, m.EventAge, m.Inbox, m.ConsumerFailures, m.Pending, m.OldestAge, m.StatsFailures)
	return m
}

func (m *WorkerMetrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}
