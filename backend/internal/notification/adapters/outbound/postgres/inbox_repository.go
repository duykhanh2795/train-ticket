package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"example.com/train-ticket/internal/notification/adapters/outbound/postgres/sqlcgen"
	notificationapp "example.com/train-ticket/internal/notification/application"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InboxRepository struct{ pool *pgxpool.Pool }

var _ notificationapp.InboxRepository = (*InboxRepository)(nil)

func NewInboxRepository(pool *pgxpool.Pool) (*InboxRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres pool is required")
	}
	return &InboxRepository{pool: pool}, nil
}

func (r *InboxRepository) Accept(ctx context.Context, consumer string, event notificationapp.BookingEvent) (bool, error) {
	payload, err := json.Marshal(event)
	if err != nil {
		return false, fmt.Errorf("encode notification job: %w", err)
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin inbox transaction: %w", err)
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	queries := sqlcgen.New(tx)
	inserted, err := queries.InsertInbox(ctx, sqlcgen.InsertInboxParams{ConsumerName: consumer, EventID: event.EventID})
	if err != nil {
		return false, fmt.Errorf("record inbox event: %w", err)
	}
	if inserted == 0 {
		return false, nil
	}
	err = queries.InsertNotificationJob(ctx, sqlcgen.InsertNotificationJobParams{
		ConsumerName: consumer, EventID: event.EventID, BookingID: event.BookingID,
		CustomerID: event.CustomerID, EventType: event.EventType, Payload: payload,
	})
	if err != nil {
		return false, fmt.Errorf("create notification job: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit inbox transaction: %w", err)
	}
	return true, nil
}
