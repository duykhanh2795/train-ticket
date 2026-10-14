package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example.com/train-ticket/internal/app"
	"example.com/train-ticket/internal/bootstrap"
)

func main() {
	if err := run(); err != nil {
		slog.Error("API process failed", "error", err)
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

	server, err := app.NewHTTPServer(runtime.Config, runtime.Logger, runtime.Postgres)
	if err != nil {
		return fmt.Errorf("build HTTP server: %w", err)
	}

	serverErr := make(chan error, 1)
	go func() {
		runtime.Logger.Info("starting API server", "address", server.Addr)
		serverErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("API server stopped: %w", err)
		}
		return nil
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful API shutdown: %w", err)
	}
	if err := <-serverErr; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("API server stopped during shutdown: %w", err)
	}
	return nil
}
