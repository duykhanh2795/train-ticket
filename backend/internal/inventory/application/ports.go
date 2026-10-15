package application

import (
	"context"

	"example.com/train-ticket/internal/inventory/domain"
)

type InventoryRepository interface {
	LoadForUpdate(ctx context.Context, tripID, seatID string) (domain.SeatInventory, error)
	LoadForBookingSeatUpdate(ctx context.Context, bookingID, seatID string) (domain.SeatInventory, error)
	ListBookingSeatIDs(ctx context.Context, bookingID string) ([]string, error)
	Save(ctx context.Context, inventory domain.SeatInventory) error
}
