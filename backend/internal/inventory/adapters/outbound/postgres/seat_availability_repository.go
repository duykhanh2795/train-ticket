package postgres

import (
	"context"
	"errors"
	"fmt"

	"example.com/train-ticket/internal/inventory/adapters/outbound/postgres/sqlcgen"
	inventoryapp "example.com/train-ticket/internal/inventory/application"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SeatAvailabilityRepository struct {
	pool *pgxpool.Pool
}

var _ inventoryapp.SeatAvailabilityRepository = (*SeatAvailabilityRepository)(nil)

func NewSeatAvailabilityRepository(pool *pgxpool.Pool) (*SeatAvailabilityRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &SeatAvailabilityRepository{pool: pool}, nil
}

func (r *SeatAvailabilityRepository) ListAvailable(ctx context.Context, tripID string, fromStop, toStop int) ([]inventoryapp.SeatAvailability, error) {
	rows, err := sqlcgen.New(r.pool).ListTripSeats(ctx, sqlcgen.ListTripSeatsParams{
		TripID:   tripID,
		FromStop: int16(fromStop),
		ToStop:   int16(toStop),
	})
	if err != nil {
		return nil, fmt.Errorf("query trip seat availability: %w", err)
	}
	seats := make([]inventoryapp.SeatAvailability, 0, len(rows))
	for _, row := range rows {
		seats = append(seats, inventoryapp.SeatAvailability{
			SeatID: row.SeatID, CoachNumber: row.CoachNumber,
			SeatNumber: row.SeatNumber, SeatType: row.SeatType, Available: row.Available,
		})
	}
	return seats, nil
}
