package config

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	HTTPAddress          string
	DatabaseURL          string
	BookingHoldDuration  time.Duration
	KafkaBrokers         []string
	KafkaTopic           string
	KafkaConsumerGroup   string
	WorkerMetricsAddress string
}

func Load() (Config, error) {
	settings := viper.New()
	settings.SetConfigName("config")
	settings.SetConfigType("yaml")
	settings.AddConfigPath(".")
	settings.SetDefault("http_address", ":8080")
	settings.SetDefault("booking_hold_duration", "10m")
	settings.SetDefault("kafka_brokers", []string{"localhost:9092"})
	settings.SetDefault("kafka_topic", "booking.events")
	settings.SetDefault("kafka_consumer_group", "notification-v1")
	settings.SetDefault("worker_metrics_address", "127.0.0.1:9091")

	if err := settings.BindEnv("http_address", "HTTP_ADDRESS"); err != nil {
		return Config{}, fmt.Errorf("bind HTTP_ADDRESS: %w", err)
	}
	if err := settings.BindEnv("database_url", "DATABASE_URL"); err != nil {
		return Config{}, fmt.Errorf("bind DATABASE_URL: %w", err)
	}
	if err := settings.BindEnv("booking_hold_duration", "BOOKING_HOLD_DURATION"); err != nil {
		return Config{}, fmt.Errorf("bind BOOKING_HOLD_DURATION: %w", err)
	}
	if err := settings.BindEnv("kafka_brokers", "KAFKA_BROKERS"); err != nil {
		return Config{}, fmt.Errorf("bind KAFKA_BROKERS: %w", err)
	}
	if err := settings.BindEnv("kafka_topic", "KAFKA_TOPIC"); err != nil {
		return Config{}, fmt.Errorf("bind KAFKA_TOPIC: %w", err)
	}
	if err := settings.BindEnv("kafka_consumer_group", "KAFKA_CONSUMER_GROUP"); err != nil {
		return Config{}, fmt.Errorf("bind KAFKA_CONSUMER_GROUP: %w", err)
	}
	if err := settings.BindEnv("worker_metrics_address", "WORKER_METRICS_ADDRESS"); err != nil {
		return Config{}, fmt.Errorf("bind WORKER_METRICS_ADDRESS: %w", err)
	}

	if err := settings.ReadInConfig(); err != nil {
		var configNotFound viper.ConfigFileNotFoundError
		if !errors.As(err, &configNotFound) {
			return Config{}, fmt.Errorf("read configuration: %w", err)
		}
	}

	address := strings.TrimSpace(settings.GetString("http_address"))
	if address == "" {
		return Config{}, fmt.Errorf("HTTP_ADDRESS must not be empty")
	}
	if len(address) > 256 {
		return Config{}, fmt.Errorf("HTTP_ADDRESS is too long")
	}
	holdDuration := settings.GetDuration("booking_hold_duration")
	if holdDuration <= 0 {
		return Config{}, fmt.Errorf("BOOKING_HOLD_DURATION must be positive")
	}

	return Config{
		HTTPAddress:          address,
		DatabaseURL:          strings.TrimSpace(settings.GetString("database_url")),
		BookingHoldDuration:  holdDuration,
		KafkaBrokers:         cleanList(settings.GetStringSlice("kafka_brokers")),
		KafkaTopic:           strings.TrimSpace(settings.GetString("kafka_topic")),
		KafkaConsumerGroup:   strings.TrimSpace(settings.GetString("kafka_consumer_group")),
		WorkerMetricsAddress: strings.TrimSpace(settings.GetString("worker_metrics_address")),
	}, nil
}

func cleanList(values []string) []string {
	cleaned := make([]string, 0, len(values))
	for _, value := range values {
		for _, broker := range strings.Split(value, ",") {
			if broker = strings.TrimSpace(broker); broker != "" {
				cleaned = append(cleaned, broker)
			}
		}
	}
	return cleaned
}
