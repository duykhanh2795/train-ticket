// Package bootstrap initializes the infrastructure shared by application
// processes, such as the API and background workers.
package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"example.com/train-ticket/internal/config"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5/pgxpool"
)

const databaseConnectTimeout = 15 * time.Second

type Runtime struct {
	Config   config.Config
	Logger   *slog.Logger
	Postgres *pgxpool.Pool
}

// Open loads configuration and opens the shared PostgreSQL connection pool.
func Open(ctx context.Context) (*Runtime, error) {
	if ctx == nil {
		return nil, errors.New("bootstrap context is required")
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("load configuration: %w", err)
	}
	if cfg.DatabaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}

	connectCtx, cancel := context.WithTimeout(ctx, databaseConnectTimeout)
	defer cancel()
	pool, err := platformpostgres.Open(connectCtx, cfg.DatabaseURL, cfg.DatabasePoolMaxConns)
	if err != nil {
		// Driver errors can contain the connection URL. Startup errors are
		// logged by cmd, so keep credentials out of process logs.
		return nil, errors.New("connect to PostgreSQL failed; check DATABASE_URL and network")
	}

	return &Runtime{Config: cfg, Logger: logger, Postgres: pool}, nil
}

func (r *Runtime) Close() {
	if r != nil && r.Postgres != nil {
		r.Postgres.Close()
	}
}
