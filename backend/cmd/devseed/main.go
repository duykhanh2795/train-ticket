// Command devseed adds a non-destructive reference trip for local development.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"example.com/train-ticket/internal/config"
	"github.com/jackc/pgx/v5"
)

func main() {
	if err := run(); err != nil {
		slog.Error("development seed failed", "reason", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil || cfg.DatabaseURL == "" {
		return &seedError{"database configuration unavailable"}
	}
	connCfg, err := pgx.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return &seedError{"invalid database configuration"}
	}
	connCfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	conn, err := pgx.ConnectConfig(ctx, connCfg)
	if err != nil {
		return &seedError{"database connection failed"}
	}
	defer conn.Close(context.Background())
	sql, err := os.ReadFile("deployments/reference-se1-seed.sql")
	if err != nil {
		return &seedError{"seed SQL unavailable"}
	}
	if _, err := conn.Exec(ctx, string(sql)); err != nil {
		return &seedError{"seed SQL failed"}
	}
	slog.Info("reference SE1 development trip seeded")
	return nil
}

type seedError struct{ message string }

func (e *seedError) Error() string { return e.message }
