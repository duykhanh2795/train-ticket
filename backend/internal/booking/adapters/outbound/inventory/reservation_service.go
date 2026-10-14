// Package inventory adapts booking's seat reservation port to the inventory context.
package inventory

import (
	"context"
	"time"

	bookingapp "example.com/train-ticket/internal/booking/application"
	inventoryapp "example.com/train-ticket/internal/inventory/application"
)

type SeatReservationService struct {
	inventory *inventoryapp.SeatReservationService
}

func NewSeatReservationService(inventory *inventoryapp.SeatReservationService) *SeatReservationService {
	return &SeatReservationService{inventory: inventory}
}

func (a *SeatReservationService) HoldSeat(ctx context.Context, request bookingapp.SeatHoldRequest) error {
	return a.inventory.HoldSeat(ctx, inventoryapp.HoldSeatCommand{
		BookingID: request.BookingID,
		TripID:    request.TripID,
		SeatID:    request.SeatID,
		FromStop:  request.FromStop,
		ToStop:    request.ToStop,
		Now:       request.Now,
		ExpiresAt: request.ExpiresAt,
	})
}

func (a *SeatReservationService) ConfirmSeat(ctx context.Context, bookingID string, at time.Time) error {
	return a.inventory.ConfirmReservation(ctx, bookingID, at)
}

func (a *SeatReservationService) ReleaseSeat(ctx context.Context, bookingID string) error {
	return a.inventory.ReleaseReservation(ctx, bookingID)
}
