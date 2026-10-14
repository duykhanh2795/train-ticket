package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

type ExpireBooking struct {
	bookings     BookingRepository
	reservations SeatReservationService
	outbox       OutboxRepository
	unitOfWork   UnitOfWork
	clock        Clock
}

func NewExpireBooking(
	bookings BookingRepository,
	reservations SeatReservationService,
	outbox OutboxRepository,
	unitOfWork UnitOfWork,
	clock Clock,
) (*ExpireBooking, error) {
	if bookings == nil || reservations == nil || outbox == nil || unitOfWork == nil || clock == nil {
		return nil, errors.New("invalid expire booking dependencies")
	}
	return &ExpireBooking{bookings: bookings, reservations: reservations, outbox: outbox, unitOfWork: unitOfWork, clock: clock}, nil
}

func (uc *ExpireBooking) Execute(ctx context.Context, bookingID string) error {
	bookingID = strings.TrimSpace(bookingID)
	if bookingID == "" {
		return ErrInvalidBookingID
	}

	err := uc.unitOfWork.WithinTransaction(ctx, func(txCtx context.Context) error {
		booking, err := uc.bookings.FindForUpdate(txCtx, bookingID)
		if err != nil {
			return err
		}
		now := uc.clock.Now()
		if err := booking.Expire(now); err != nil {
			return err
		}
		if err := uc.reservations.ReleaseSeat(txCtx, bookingID); err != nil {
			return fmt.Errorf("release expired seat reservation: %w", err)
		}
		if err := uc.bookings.Update(txCtx, booking); err != nil {
			return fmt.Errorf("update expired booking: %w", err)
		}
		event, err := newBookingLifecycleEvent(booking, "booking.expired", now)
		if err != nil {
			return err
		}
		if err := uc.outbox.Enqueue(txCtx, event); err != nil {
			return fmt.Errorf("enqueue booking expired event: %w", err)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("expire booking: %w", err)
	}
	return nil
}
