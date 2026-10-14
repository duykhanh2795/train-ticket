package application

import (
	"context"

	"example.com/train-ticket/internal/inventory/domain"
)

type InventoryRepository interface {
	LoadForUpdate(ctx context.Context, tripID, seatID string) (domain.SeatInventory, error)
	LoadForBookingUpdate(ctx context.Context, bookingID string) (domain.SeatInventory, error)
	Save(ctx context.Context, inventory domain.SeatInventory) error
}
