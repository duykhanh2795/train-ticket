package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"example.com/train-ticket/internal/schedule/adapters/outbound/postgres/sqlcgen"
	"example.com/train-ticket/internal/schedule/application"
)

// TripSearchRepository is the PostgreSQL adapter for the schedule search port.
type TripSearchRepository struct {
	queries *sqlcgen.Queries
}

var _ application.TripSearchRepository = (*TripSearchRepository)(nil)

func NewTripSearchRepository(pool *pgxpool.Pool) (*TripSearchRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &TripSearchRepository{queries: sqlcgen.New(pool)}, nil
}

func (r *TripSearchRepository) Search(
	ctx context.Context,
	query application.TripSearchQuery,
) ([]application.TripSearchResult, error) {
	rows, err := r.queries.SearchTrips(ctx, sqlcgen.SearchTripsParams{
		OriginStationID:      query.OriginStationID,
		DestinationStationID: query.DestinationStationID,
		ServiceDate:          pgtype.Date{Time: query.ServiceDate, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("query trips by stations and service date: %w", err)
	}

	results := make([]application.TripSearchResult, 0, len(rows))
	for _, row := range rows {
		if !row.ServiceDate.Valid || !row.DepartureAt.Valid || !row.ArrivalAt.Valid {
			return nil, fmt.Errorf("trip %q has incomplete schedule data", row.TripID)
		}
		results = append(results, application.TripSearchResult{
			TripID:      row.TripID,
			TrainNumber: row.TrainNumber,
			ServiceDate: row.ServiceDate.Time,
			FromStop:    int(row.FromStop),
			ToStop:      int(row.ToStop),
			DepartureAt: row.DepartureAt.Time,
			ArrivalAt:   row.ArrivalAt.Time,
		})
	}
	return results, nil
}
