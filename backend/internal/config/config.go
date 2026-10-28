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
	HTTPTrustedProxies   []string
	DatabaseURL          string
	DatabasePoolMaxConns int32
	BookingHoldDuration  time.Duration
	KafkaBrokers         []string
	KafkaTopic           string
	KafkaConsumerGroup   string
	WorkerMetricsAddress string
	PaymentMode          string
	VNPAYTMNCode         string
	VNPAYHashSecret      string
	VNPAYReturnURL       string
	SMTPHost             string
	SMTPPort             int
	SMTPMode             string
	SMTPUsername         string
	SMTPPassword         string
	SMTPFrom             string
	PublicAppURL         string
}

func Load() (Config, error) {
	settings := viper.New()
	settings.SetConfigName("config")
	settings.SetConfigType("yaml")
	settings.AddConfigPath(".")
	settings.SetDefault("http_address", ":8080")
	settings.SetDefault("database_pool_max_conns", 10)
	settings.SetDefault("booking_hold_duration", "10m")
	settings.SetDefault("kafka_brokers", []string{"localhost:9092"})
	settings.SetDefault("kafka_topic", "booking.events")
	settings.SetDefault("kafka_consumer_group", "notification-v1")
	settings.SetDefault("worker_metrics_address", "127.0.0.1:9091")
	settings.SetDefault("payment_mode", "vnpay")
	settings.SetDefault("smtp_port", 587)
	settings.SetDefault("smtp_mode", "starttls")
	settings.SetDefault("public_app_url", "http://localhost:3000")

	if err := settings.BindEnv("http_address", "HTTP_ADDRESS"); err != nil {
		return Config{}, fmt.Errorf("bind HTTP_ADDRESS: %w", err)
	}
	if err := settings.BindEnv("http_trusted_proxies", "HTTP_TRUSTED_PROXIES"); err != nil {
		return Config{}, fmt.Errorf("bind HTTP_TRUSTED_PROXIES: %w", err)
	}
	if err := settings.BindEnv("database_url", "DATABASE_URL"); err != nil {
		return Config{}, fmt.Errorf("bind DATABASE_URL: %w", err)
	}
	if err := settings.BindEnv("database_pool_max_conns", "DATABASE_POOL_MAX_CONNS"); err != nil {
		return Config{}, fmt.Errorf("bind DATABASE_POOL_MAX_CONNS: %w", err)
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
	for _, item := range []struct{ key, env string }{
		{"payment_mode", "PAYMENT_MODE"},
		{"vnpay_tmn_code", "VNPAY_TMN_CODE"},
		{"vnpay_hash_secret", "VNPAY_HASH_SECRET"},
		{"vnpay_return_url", "VNPAY_RETURN_URL"},
		{"smtp_host", "SMTP_HOST"},
		{"smtp_port", "SMTP_PORT"},
		{"smtp_mode", "SMTP_MODE"},
		{"smtp_username", "SMTP_USERNAME"},
		{"smtp_password", "SMTP_PASSWORD"},
		{"smtp_from", "SMTP_FROM"},
		{"public_app_url", "PUBLIC_APP_URL"},
	} {
		if err := settings.BindEnv(item.key, item.env); err != nil {
			return Config{}, fmt.Errorf("bind %s: %w", item.env, err)
		}
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
	poolMaxConns := settings.GetInt("database_pool_max_conns")
	if poolMaxConns < 1 || poolMaxConns > 1000 {
		return Config{}, fmt.Errorf("DATABASE_POOL_MAX_CONNS must be between 1 and 1000")
	}
	if holdDuration <= 0 {
		return Config{}, fmt.Errorf("BOOKING_HOLD_DURATION must be positive")
	}

	return Config{
		HTTPAddress:          address,
		HTTPTrustedProxies:   cleanList(settings.GetStringSlice("http_trusted_proxies")),
		DatabaseURL:          strings.TrimSpace(settings.GetString("database_url")),
		DatabasePoolMaxConns: int32(poolMaxConns),
		BookingHoldDuration:  holdDuration,
		KafkaBrokers:         cleanList(settings.GetStringSlice("kafka_brokers")),
		KafkaTopic:           strings.TrimSpace(settings.GetString("kafka_topic")),
		KafkaConsumerGroup:   strings.TrimSpace(settings.GetString("kafka_consumer_group")),
		WorkerMetricsAddress: strings.TrimSpace(settings.GetString("worker_metrics_address")),
		PaymentMode:          strings.ToLower(strings.TrimSpace(settings.GetString("payment_mode"))),
		VNPAYTMNCode:         strings.TrimSpace(settings.GetString("vnpay_tmn_code")),
		VNPAYHashSecret:      strings.TrimSpace(settings.GetString("vnpay_hash_secret")),
		VNPAYReturnURL:       strings.TrimSpace(settings.GetString("vnpay_return_url")),
		SMTPHost:             strings.TrimSpace(settings.GetString("smtp_host")),
		SMTPPort:             settings.GetInt("smtp_port"),
		SMTPMode:             strings.TrimSpace(settings.GetString("smtp_mode")),
		SMTPUsername:         strings.TrimSpace(settings.GetString("smtp_username")),
		SMTPPassword:         settings.GetString("smtp_password"),
		SMTPFrom:             strings.TrimSpace(settings.GetString("smtp_from")),
		PublicAppURL:         strings.TrimSpace(settings.GetString("public_app_url")),
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
