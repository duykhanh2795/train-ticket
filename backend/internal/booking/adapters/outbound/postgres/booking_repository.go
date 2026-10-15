package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"example.com/train-ticket/internal/booking/adapters/outbound/postgres/sqlcgen"
	bookingapp "example.com/train-ticket/internal/booking/application"
	bookingdomain "example.com/train-ticket/internal/booking/domain"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BookingRepository struct {
	pool *pgxpool.Pool
}

var _ bookingapp.BookingRepository = (*BookingRepository)(nil)

func NewBookingRepository(pool *pgxpool.Pool) (*BookingRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &BookingRepository{pool: pool}, nil
}

func (r *BookingRepository) Create(ctx context.Context, booking bookingdomain.Booking) error {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return err
	}
	queries := sqlcgen.New(platformpostgres.Executor(ctx, r.pool))
	err := queries.CreateBooking(ctx, sqlcgen.CreateBookingParams{
		ID:         booking.ID(),
		CustomerID: booking.CustomerID(),
		TripID:     booking.TripID(),
		Status:     booking.Status().String(),
		CreatedAt:  pgtype.Timestamptz{Time: booking.CreatedAt(), Valid: true},
		ExpiresAt:  pgtype.Timestamptz{Time: booking.ExpiresAt(), Valid: true},
		FareVnd:    pgtype.Int8{Int64: booking.FareVND(), Valid: true},
	})
	if err == nil {
		return nil
	}
	var postgresErr *pgconn.PgError
	if errors.As(err, &postgresErr) && postgresErr.Code == "23503" &&
		postgresErr.ConstraintName == "bookings_trip_id_fkey" {
		return fmt.Errorf("%w: %s", bookingapp.ErrTripNotFound, booking.TripID())
	}
	return fmt.Errorf("insert booking %q: %w", booking.ID(), err)
}

func (r *BookingRepository) FindForUpdate(ctx context.Context, bookingID string) (bookingdomain.Booking, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return bookingdomain.Booking{}, err
	}
	row, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).FindBookingForUpdate(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return bookingdomain.Booking{}, bookingapp.ErrBookingNotFound
	}
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("load booking %q for update: %w", bookingID, err)
	}
	if !row.CreatedAt.Valid || !row.ExpiresAt.Valid {
		return bookingdomain.Booking{}, fmt.Errorf("booking %q has incomplete timestamps", bookingID)
	}
	status, err := parseBookingStatus(row.Status)
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("booking %q: %w", bookingID, err)
	}
	booking, err := bookingdomain.RestoreBooking(
		row.ID, row.CustomerID, row.TripID, status, row.CreatedAt.Time, row.ExpiresAt.Time, row.FareVnd.Int64,
	)
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("restore booking %q: %w", bookingID, err)
	}
	return booking, nil
}

func (r *BookingRepository) Update(ctx context.Context, booking bookingdomain.Booking) error {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return err
	}
	rowsAffected, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).UpdateBookingStatus(ctx, sqlcgen.UpdateBookingStatusParams{
		ID:     booking.ID(),
		Status: booking.Status().String(),
	})
	if err != nil {
		return fmt.Errorf("update booking %q: %w", booking.ID(), err)
	}
	if rowsAffected != 1 {
		return bookingapp.ErrBookingNotFound
	}
	return nil
}

func (r *BookingRepository) ListExpiredHolds(ctx context.Context, at time.Time, limit int) ([]string, error) {
	if limit <= 0 {
		return []string{}, nil
	}
	if limit > 500 {
		limit = 500
	}
	ids, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).ListExpiredBookingHolds(
		ctx,
		sqlcgen.ListExpiredBookingHoldsParams{
			At:       pgtype.Timestamptz{Time: at, Valid: true},
			RowLimit: int32(limit),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("list expired booking holds: %w", err)
	}
	return ids, nil
}

func parseBookingStatus(value string) (bookingdomain.Status, error) {
	switch value {
	case "held":
		return bookingdomain.StatusHeld, nil
	case "confirmed":
		return bookingdomain.StatusConfirmed, nil
	case "cancelled":
		return bookingdomain.StatusCancelled, nil
	case "expired":
		return bookingdomain.StatusExpired, nil
	default:
		return 0, fmt.Errorf("unknown booking status %q", value)
	}
}
