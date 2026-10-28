package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"example.com/train-ticket/internal/payment/adapters/outbound/postgres/sqlcgen"
	paymentapp "example.com/train-ticket/internal/payment/application"
	"example.com/train-ticket/internal/payment/domain"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ pool *pgxpool.Pool }

var _ paymentapp.AttemptRepository = (*Repository)(nil)

func NewRepository(pool *pgxpool.Pool) (*Repository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &Repository{pool: pool}, nil
}

func (r *Repository) queries(ctx context.Context) *sqlcgen.Queries {
	return sqlcgen.New(platformpostgres.Executor(ctx, r.pool))
}

func (r *Repository) Create(ctx context.Context, bookingID string, amount int64, createdAt, expiresAt time.Time) (domain.Attempt, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return domain.Attempt{}, err
	}
	row, err := r.queries(ctx).CreateAttempt(ctx, sqlcgen.CreateAttemptParams{
		BookingID: bookingID, AmountVnd: amount,
		CreatedAt: pgtype.Timestamptz{Time: createdAt, Valid: true},
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return domain.Attempt{}, fmt.Errorf("create payment attempt: %w", err)
	}
	return mapAttempt(row), nil
}
func (r *Repository) SaveCheckoutURL(ctx context.Context, id int64, checkoutURL string) error {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return err
	}
	count, err := r.queries(ctx).SaveCheckoutURL(ctx, sqlcgen.SaveCheckoutURLParams{ID: id, CheckoutUrl: checkoutURL})
	if err != nil {
		return fmt.Errorf("save checkout URL: %w", err)
	}
	if count != 1 {
		return domain.ErrInvalidState
	}
	return nil
}
func (r *Repository) FindPendingForBooking(ctx context.Context, bookingID string) (domain.Attempt, error) {
	row, err := r.queries(ctx).FindPendingAttempt(ctx, bookingID)
	return mapped(row, err)
}
func (r *Repository) FindByID(ctx context.Context, id int64) (domain.Attempt, error) {
	row, err := r.queries(ctx).FindAttempt(ctx, id)
	return mapped(row, err)
}
func (r *Repository) FindOwnedByID(ctx context.Context, id int64, customerID string) (domain.Attempt, error) {
	row, err := r.queries(ctx).FindOwnedAttempt(ctx, sqlcgen.FindOwnedAttemptParams{ID: id, CustomerID: customerID})
	return mapped(row, err)
}
func (r *Repository) FindForUpdate(ctx context.Context, id int64) (domain.Attempt, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return domain.Attempt{}, err
	}
	row, err := r.queries(ctx).LockAttempt(ctx, id)
	return mapped(row, err)
}
func (r *Repository) Settle(ctx context.Context, attempt domain.Attempt) error {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return err
	}
	count, err := r.queries(ctx).SettleAttempt(ctx, sqlcgen.SettleAttemptParams{
		ID: attempt.ID, Status: string(attempt.Status),
		ProviderTxnID:     pgtype.Text{String: attempt.ProviderTxnID, Valid: attempt.ProviderTxnID != ""},
		ResponseCode:      pgtype.Text{String: attempt.ResponseCode, Valid: true},
		TransactionStatus: pgtype.Text{String: attempt.TransactionStatus, Valid: true},
		UpdatedAt:         pgtype.Timestamptz{Time: attempt.UpdatedAt, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("settle payment attempt: %w", err)
	}
	if count != 1 {
		return domain.ErrInvalidState
	}
	return nil
}
func mapped(row sqlcgen.PaymentAttempt, err error) (domain.Attempt, error) {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Attempt{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Attempt{}, fmt.Errorf("read payment attempt: %w", err)
	}
	return mapAttempt(row), nil
}
func mapAttempt(row sqlcgen.PaymentAttempt) domain.Attempt {
	return domain.Attempt{
		ID: row.ID, BookingID: row.BookingID, AmountVND: row.AmountVnd, Status: domain.Status(row.Status),
		CheckoutURL: row.CheckoutUrl, ProviderTxnID: row.ProviderTxnID.String,
		ResponseCode: row.ResponseCode.String, TransactionStatus: row.TransactionStatus.String,
		CreatedAt: row.CreatedAt.Time, ExpiresAt: row.ExpiresAt.Time, UpdatedAt: row.UpdatedAt.Time,
	}
}
