package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example.com/train-ticket/internal/config"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func main() {
	action := flag.String("action", "up", "up or status")
	flag.Parse()
	if err := run(*action); err != nil {
		// Do not print driver errors that could embed a credential-bearing URL.
		slog.Error("migration command failed", "stage", err.Error())
		os.Exit(1)
	}
}

func run(action string) error {
	if action != "up" && action != "status" {
		return errors.New("action must be up or status")
	}
	cfg, err := config.Load()
	if err != nil {
		return errors.New("could not load configuration")
	}
	if cfg.DatabaseURL == "" {
		return errors.New("database_url is required in config.yaml or DATABASE_URL")
	}
	conn, err := pgx.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return errors.New("invalid database connection configuration")
	}
	conn.DefaultQueryExecMode = pgx.QueryExecModeExec
	db := stdlib.OpenDB(*conn)
	defer db.Close()
	db.SetMaxOpenConns(1)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pingCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	err = db.PingContext(pingCtx)
	cancel()
	if err != nil {
		return errors.New("database connection failed; check Neon endpoint and credentials")
	}
	if err := goose.SetDialect("postgres"); err != nil {
		return errors.New("could not configure migration dialect")
	}
	if action == "status" {
		err = goose.StatusContext(ctx, db, "migrations")
	} else {
		err = goose.UpContext(ctx, db, "migrations")
	}
	if err != nil {
		return errors.New("migration failed; review Goose output above")
	}
	return nil
}
