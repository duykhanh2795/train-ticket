package postgres

import (
	"context"
	"errors"
	"fmt"

	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"example.com/train-ticket/internal/pricing/adapters/outbound/postgres/sqlcgen"
	pricingapp "example.com/train-ticket/internal/pricing/application"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FareRepository struct{ pool *pgxpool.Pool }

var _ pricingapp.FareRepository = (*FareRepository)(nil)

func NewFareRepository(pool *pgxpool.Pool) (*FareRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &FareRepository{pool: pool}, nil
}

func (r *FareRepository) ListSegmentFares(ctx context.Context, tripID string, fromStop, toStop int) ([]pricingapp.SegmentFare, error) {
	rows, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).ListSegmentFares(ctx, sqlcgen.ListSegmentFaresParams{
		TripID: tripID, FromStop: int16(fromStop), ToStop: int16(toStop),
	})
	if err != nil {
		return nil, fmt.Errorf("list fares: %w", err)
	}
	fares := make([]pricingapp.SegmentFare, 0, len(rows))
	for _, row := range rows {
		fares = append(fares, pricingapp.SegmentFare{SeatType: row.SeatType, FromStop: int(row.FromStop), AmountVND: row.AmountVnd})
	}
	return fares, nil
}

func (r *FareRepository) SeatType(ctx context.Context, tripID, seatID string) (string, error) {
	seatType, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).GetSeatType(ctx, sqlcgen.GetSeatTypeParams{TripID: tripID, SeatID: seatID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", pricingapp.ErrSeatNotFound
	}
	if err != nil {
		return "", fmt.Errorf("get seat type: %w", err)
	}
	return seatType, nil
}
