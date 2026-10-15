package application

import (
	"context"
	"errors"
	"time"

	"example.com/train-ticket/internal/inventory/domain"
)

type HoldSeatCommand struct {
	BookingID string
	TripID    string
	SeatID    string
	FromStop  int
	ToStop    int
	Now       time.Time
	ExpiresAt time.Time
}

type SeatReservationService struct {
	repository InventoryRepository
}

func NewSeatReservationService(repository InventoryRepository) (*SeatReservationService, error) {
	if repository == nil {
		return nil, errors.New("inventory repository is required")
	}
	return &SeatReservationService{repository: repository}, nil
}

// HoldSeat must be called inside the booking use case's transaction.
func (s *SeatReservationService) HoldSeat(ctx context.Context, command HoldSeatCommand) error {
	segment, err := domain.NewSegment(command.FromStop, command.ToStop)
	if err != nil {
		return err
	}

	inventory, err := s.repository.LoadForUpdate(ctx, command.TripID, command.SeatID)
	if err != nil {
		return err
	}
	if err := inventory.Hold(command.BookingID, segment, command.Now, command.ExpiresAt); err != nil {
		return err
	}
	return s.repository.Save(ctx, inventory)
}

func (s *SeatReservationService) ConfirmReservation(ctx context.Context, bookingID string, at time.Time) error {
	seatIDs, err := s.repository.ListBookingSeatIDs(ctx, bookingID)
	if err != nil {
		return err
	}
	for _, seatID := range seatIDs {
		inventory, err := s.repository.LoadForBookingSeatUpdate(ctx, bookingID, seatID)
		if err != nil {
			return err
		}
		if err := inventory.Confirm(bookingID, at); err != nil {
			return err
		}
		if err := s.repository.Save(ctx, inventory); err != nil {
			return err
		}
	}
	return nil
}

func (s *SeatReservationService) ReleaseReservation(ctx context.Context, bookingID string) error {
	seatIDs, err := s.repository.ListBookingSeatIDs(ctx, bookingID)
	if err != nil {
		return err
	}
	for _, seatID := range seatIDs {
		inventory, err := s.repository.LoadForBookingSeatUpdate(ctx, bookingID, seatID)
		if err != nil {
			return err
		}
		if err := inventory.Release(bookingID); err != nil {
			return err
		}
		if err := s.repository.Save(ctx, inventory); err != nil {
			return err
		}
	}
	return nil
}
