package application

import (
	"context"
	"time"

	"example.com/train-ticket/internal/passenger/domain"
)

type SavedPassengerRepository interface {
	Create(ctx context.Context, passenger domain.SavedPassenger) error
	ListByOwner(ctx context.Context, ownerID string) ([]domain.SavedPassenger, error)
	FindByIDAndOwner(ctx context.Context, id, ownerID string) (domain.SavedPassenger, error)
	Update(ctx context.Context, passenger domain.SavedPassenger) error
	Delete(ctx context.Context, id, ownerID string) error
}

type IDGenerator interface {
	NewID() (string, error)
}

type Clock interface {
	Now() time.Time
}
