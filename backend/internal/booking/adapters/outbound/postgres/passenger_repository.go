package postgres

import (
	"context"
	"errors"
	"fmt"

	"example.com/train-ticket/internal/booking/adapters/outbound/postgres/sqlcgen"
	bookingapp "example.com/train-ticket/internal/booking/application"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BookingPassengerRepository struct{ pool *pgxpool.Pool }

var _ bookingapp.BookingPassengerRepository = (*BookingPassengerRepository)(nil)

func NewBookingPassengerRepository(pool *pgxpool.Pool) (*BookingPassengerRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &BookingPassengerRepository{pool: pool}, nil
}

func (r *BookingPassengerRepository) Create(ctx context.Context, bookingID, seatID, fullName string) error {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return err
	}
	if err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).CreateBookingPassenger(ctx, sqlcgen.CreateBookingPassengerParams{
		BookingID: bookingID, SeatID: seatID, FullName: fullName,
	}); err != nil {
		return fmt.Errorf("create passenger for booking %q seat %q: %w", bookingID, seatID, err)
	}
	return nil
}
