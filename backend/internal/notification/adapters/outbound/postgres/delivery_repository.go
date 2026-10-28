package postgres

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"example.com/train-ticket/internal/notification/adapters/outbound/postgres/sqlcgen"
	notificationapp "example.com/train-ticket/internal/notification/application"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DeliveryRepository struct{ pool *pgxpool.Pool }

var _ notificationapp.DeliveryRepository = (*DeliveryRepository)(nil)

func NewDeliveryRepository(pool *pgxpool.Pool) (*DeliveryRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres pool is required")
	}
	return &DeliveryRepository{pool: pool}, nil
}

func (r *DeliveryRepository) Claim(ctx context.Context, at time.Time, lease time.Duration) (notificationapp.DeliveryJob, bool, error) {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return notificationapp.DeliveryJob{}, false, fmt.Errorf("create delivery claim: %w", err)
	}
	token := hex.EncodeToString(bytes[:])
	row, err := sqlcgen.New(r.pool).ClaimNotificationJob(ctx, sqlcgen.ClaimNotificationJobParams{
		ClaimToken:   pgtype.Text{String: token, Valid: true},
		ClaimedUntil: pgtype.Timestamptz{Time: at.Add(lease), Valid: true},
		At:           pgtype.Timestamptz{Time: at, Valid: true},
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return notificationapp.DeliveryJob{}, false, nil
	}
	if err != nil {
		return notificationapp.DeliveryJob{}, false, fmt.Errorf("claim notification: %w", err)
	}
	return notificationapp.DeliveryJob{ID: row.ID, BookingID: row.BookingID, CustomerID: row.CustomerID, EventType: row.EventType, EventID: row.EventID, Attempts: row.Attempts, ClaimToken: token}, true, nil
}

func (r *DeliveryRepository) Confirmation(ctx context.Context, bookingID, customerID string) (notificationapp.ConfirmationEmail, error) {
	row, err := sqlcgen.New(r.pool).FindConfirmationEmail(ctx, sqlcgen.FindConfirmationEmailParams{BookingID: bookingID, CustomerID: customerID})
	if err != nil {
		return notificationapp.ConfirmationEmail{}, fmt.Errorf("find booking confirmation: %w", err)
	}
	return notificationapp.ConfirmationEmail{Recipient: row.Email, CustomerName: row.FullName, TrainNumber: row.TrainNumber, ServiceDate: row.ServiceDate, OriginStation: row.OriginStation, DestinationStation: row.DestinationStation}, nil
}

func (r *DeliveryRepository) MarkSent(ctx context.Context, job notificationapp.DeliveryJob, at time.Time) error {
	rows, err := sqlcgen.New(r.pool).MarkNotificationSent(ctx, sqlcgen.MarkNotificationSentParams{ID: job.ID, ClaimToken: pgtype.Text{String: job.ClaimToken, Valid: true}, At: pgtype.Timestamptz{Time: at, Valid: true}})
	return deliveryUpdateError(rows, err)
}

func (r *DeliveryRepository) MarkSkipped(ctx context.Context, job notificationapp.DeliveryJob) error {
	rows, err := sqlcgen.New(r.pool).MarkNotificationSkipped(ctx, sqlcgen.MarkNotificationSkippedParams{ID: job.ID, ClaimToken: pgtype.Text{String: job.ClaimToken, Valid: true}})
	return deliveryUpdateError(rows, err)
}

func (r *DeliveryRepository) MarkFailed(ctx context.Context, job notificationapp.DeliveryJob, next time.Time, code string, terminal bool) error {
	status := "pending"
	if terminal {
		status = "failed"
	}
	rows, err := sqlcgen.New(r.pool).MarkNotificationAttemptFailed(ctx, sqlcgen.MarkNotificationAttemptFailedParams{ID: job.ID, ClaimToken: pgtype.Text{String: job.ClaimToken, Valid: true}, Status: status, NextAttemptAt: pgtype.Timestamptz{Time: next, Valid: true}, ErrorCode: pgtype.Text{String: code, Valid: true}})
	return deliveryUpdateError(rows, err)
}

func deliveryUpdateError(rows int64, err error) error {
	if err != nil {
		return err
	}
	if rows != 1 {
		return errors.New("notification claim was lost")
	}
	return nil
}
