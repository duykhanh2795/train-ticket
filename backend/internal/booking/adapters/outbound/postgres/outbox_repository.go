package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"example.com/train-ticket/internal/booking/adapters/outbound/postgres/sqlcgen"
	bookingapp "example.com/train-ticket/internal/booking/application"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OutboxRepository struct{ pool *pgxpool.Pool }

var _ bookingapp.OutboxRepository = (*OutboxRepository)(nil)

func NewOutboxRepository(pool *pgxpool.Pool) (*OutboxRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &OutboxRepository{pool: pool}, nil
}

func (r *OutboxRepository) Enqueue(ctx context.Context, m bookingapp.OutboxMessage) error {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return err
	}
	err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).EnqueueOutbox(ctx, sqlcgen.EnqueueOutboxParams{
		ID: m.ID, AggregateType: m.AggregateType, AggregateID: m.AggregateID,
		EventType: m.EventType, Payload: m.Payload, OccurredAt: timestamp(m.OccurredAt),
	})
	if err != nil {
		return fmt.Errorf("enqueue outbox %q: %w", m.ID, err)
	}
	return nil
}

func (r *OutboxRepository) Claim(ctx context.Context, owner string, now, until time.Time, limit int) ([]bookingapp.OutboxMessage, error) {
	if strings.TrimSpace(owner) == "" || limit <= 0 || !until.After(now) {
		return nil, errors.New("invalid outbox claim")
	}
	if limit > 500 {
		limit = 500
	}
	rows, err := sqlcgen.New(r.pool).ClaimOutbox(ctx, sqlcgen.ClaimOutboxParams{
		Owner: owner, ClaimTime: timestamp(now), LeaseUntil: timestamp(until), BatchSize: int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("claim outbox: %w", err)
	}
	messages := make([]bookingapp.OutboxMessage, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, bookingapp.OutboxMessage{
			ID: row.ID, AggregateType: row.AggregateType, AggregateID: row.AggregateID,
			EventType: row.EventType, Payload: row.Payload, OccurredAt: row.OccurredAt.Time, Attempts: int(row.Attempts),
		})
	}
	return messages, nil
}

func (r *OutboxRepository) MarkPublished(ctx context.Context, id, owner string, at time.Time) error {
	rows, err := sqlcgen.New(r.pool).MarkOutboxPublished(ctx, sqlcgen.MarkOutboxPublishedParams{ID: id, Owner: owner, PublishedAt: timestamp(at)})
	return checkLease(rows, err, id)
}

func (r *OutboxRepository) MarkFailed(ctx context.Context, id, owner string, at time.Time, cause error) error {
	if cause == nil {
		return errors.New("outbox failure cause is required")
	}
	detail := []rune(cause.Error())
	if len(detail) > 2000 {
		detail = detail[:2000]
	}
	rows, err := sqlcgen.New(r.pool).MarkOutboxFailed(ctx, sqlcgen.MarkOutboxFailedParams{ID: id, Owner: owner, FailedAt: timestamp(at), Detail: string(detail)})
	return checkLease(rows, err, id)
}

func (r *OutboxRepository) Stats(ctx context.Context) (int64, float64, error) {
	row, err := sqlcgen.New(r.pool).OutboxStats(ctx)
	return row.Pending, row.OldestAgeSeconds, err
}

func timestamp(at time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: at, Valid: true} }
func checkLease(rows int64, err error, id string) error {
	if err != nil {
		return fmt.Errorf("update outbox %q: %w", id, err)
	}
	if rows != 1 {
		return fmt.Errorf("outbox %q is no longer leased by this worker", id)
	}
	return nil
}
