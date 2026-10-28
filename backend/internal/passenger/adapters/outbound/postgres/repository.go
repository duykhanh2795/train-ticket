package postgres

import (
	"context"
	"errors"
	"fmt"

	"example.com/train-ticket/internal/passenger/adapters/outbound/postgres/sqlcgen"
	passengerapp "example.com/train-ticket/internal/passenger/application"
	"example.com/train-ticket/internal/passenger/domain"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SavedPassengerRepository struct {
	pool *pgxpool.Pool
}

var _ passengerapp.SavedPassengerRepository = (*SavedPassengerRepository)(nil)

func NewSavedPassengerRepository(pool *pgxpool.Pool) (*SavedPassengerRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &SavedPassengerRepository{pool: pool}, nil
}

func (p *SavedPassengerRepository) Create(ctx context.Context, passenger domain.SavedPassenger) error {
	queries := sqlcgen.New(platformpostgres.Executor(ctx, p.pool))
	if err := queries.CreateSavedPassenger(ctx, sqlcgen.CreateSavedPassengerParams{
		ID:        passenger.ID(),
		OwnerID:   passenger.OwnerID(),
		FullName:  passenger.FullName(),
		CreatedAt: pgtype.Timestamptz{Time: passenger.CreatedAt(), Valid: true},
	}); err != nil {
		return fmt.Errorf("create saved passenger: %w", err)
	}
	return nil
}

func (p *SavedPassengerRepository) ListByOwner(ctx context.Context, ownerID string) ([]domain.SavedPassenger, error) {
	queries := sqlcgen.New(platformpostgres.Executor(ctx, p.pool))
	rows, err := queries.ListSavedPassengersByOwner(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list saved passengers: %w", err)
	}
	result := make([]domain.SavedPassenger, 0, len(rows))
	for _, row := range rows {
		passenger, err := mapSavedPassenger(row)
		if err != nil {
			return nil, err
		}
		result = append(result, passenger)
	}
	return result, nil
}

func (p *SavedPassengerRepository) FindByIDAndOwner(ctx context.Context, id, ownerID string) (domain.SavedPassenger, error) {
	queries := sqlcgen.New(platformpostgres.Executor(ctx, p.pool))
	row, err := queries.GetSavedPassengerByIDAndOwner(ctx, sqlcgen.GetSavedPassengerByIDAndOwnerParams{
		ID: id, OwnerID: ownerID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SavedPassenger{}, domain.ErrSavedPassengerNotFound
	}
	if err != nil {
		return domain.SavedPassenger{}, fmt.Errorf("get saved passenger: %w", err)
	}
	return mapSavedPassenger(row)
}

func (p *SavedPassengerRepository) Update(ctx context.Context, passenger domain.SavedPassenger) error {
	queries := sqlcgen.New(platformpostgres.Executor(ctx, p.pool))
	rowsAffected, err := queries.UpdateSavedPassenger(ctx, sqlcgen.UpdateSavedPassengerParams{
		ID: passenger.ID(), OwnerID: passenger.OwnerID(), FullName: passenger.FullName(),
	})
	if err != nil {
		return fmt.Errorf("update saved passenger: %w", err)
	}
	if rowsAffected == 0 {
		return domain.ErrSavedPassengerNotFound
	}
	return nil
}

func (p *SavedPassengerRepository) Delete(ctx context.Context, id, ownerID string) error {
	queries := sqlcgen.New(platformpostgres.Executor(ctx, p.pool))
	rowsAffected, err := queries.DeleteSavedPassenger(ctx, sqlcgen.DeleteSavedPassengerParams{
		ID: id, OwnerID: ownerID,
	})
	if err != nil {
		return fmt.Errorf("delete saved passenger: %w", err)
	}
	if rowsAffected == 0 {
		return domain.ErrSavedPassengerNotFound
	}
	return nil
}

func mapSavedPassenger(row sqlcgen.SavedPassenger) (domain.SavedPassenger, error) {
	if !row.CreatedAt.Valid {
		return domain.SavedPassenger{}, fmt.Errorf("saved passenger %q has no creation time", row.ID)
	}
	passenger, err := domain.NewSavedPassenger(row.ID, row.OwnerID, row.FullName, row.CreatedAt.Time)
	if err != nil {
		return domain.SavedPassenger{}, fmt.Errorf("map saved passenger %q: %w", row.ID, err)
	}
	return passenger, nil
}
