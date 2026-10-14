package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"example.com/train-ticket/internal/app"
	"example.com/train-ticket/internal/bootstrap"
)

func main() {
	if err := run(); err != nil {
		slog.Error("worker process failed", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	runtime, err := bootstrap.Open(ctx)
	if err != nil {
		return err
	}
	defer runtime.Close()
	worker, err := app.NewWorker(runtime.Config, runtime.Logger, runtime.Postgres)
	if err != nil {
		return err
	}
	defer func() {
		if err := worker.Close(); err != nil {
			runtime.Logger.Error("close worker", "error", err)
		}
	}()
	return worker.Run(ctx)
}
