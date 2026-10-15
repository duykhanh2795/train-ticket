package application

import (
	"context"
	"errors"
	"fmt"
	"strings"

	bookingdomain "example.com/train-ticket/internal/booking/domain"
)

// CancelBooking releases an active hold and records its integration event atomically.
type CancelBooking struct {
	bookings     BookingRepository
	reservations SeatReservationService
	outbox       OutboxRepository
	unitOfWork   UnitOfWork
	clock        Clock
}

func NewCancelBooking(bookings BookingRepository, reservations SeatReservationService, outbox OutboxRepository, unitOfWork UnitOfWork, clock Clock) (*CancelBooking, error) {
	if bookings == nil || reservations == nil || outbox == nil || unitOfWork == nil || clock == nil {
		return nil, errors.New("invalid cancel booking dependencies")
	}
	return &CancelBooking{bookings: bookings, reservations: reservations, outbox: outbox, unitOfWork: unitOfWork, clock: clock}, nil
}

func (uc *CancelBooking) Execute(ctx context.Context, bookingID, customerID string) (bookingdomain.Booking, error) {
	bookingID = strings.TrimSpace(bookingID)
	if bookingID == "" || strings.TrimSpace(customerID) == "" {
		return bookingdomain.Booking{}, ErrInvalidBookingID
	}

	var cancelled bookingdomain.Booking
	err := uc.unitOfWork.WithinTransaction(ctx, func(txCtx context.Context) error {
		booking, err := uc.bookings.FindForUpdate(txCtx, bookingID)
		if err != nil {
			return err
		}
		if booking.CustomerID() != customerID {
			return ErrBookingNotFound
		}
		now := uc.clock.Now()
		if err := booking.Cancel(now); err != nil {
			return err
		}
		if err := uc.reservations.ReleaseSeat(txCtx, bookingID); err != nil {
			return fmt.Errorf("release cancelled seat reservation: %w", err)
		}
		if err := uc.bookings.Update(txCtx, booking); err != nil {
			return fmt.Errorf("update cancelled booking: %w", err)
		}
		event, err := newBookingLifecycleEvent(booking, "booking.cancelled", now)
		if err != nil {
			return err
		}
		if err := uc.outbox.Enqueue(txCtx, event); err != nil {
			return fmt.Errorf("enqueue booking cancelled event: %w", err)
		}
		cancelled = booking
		return nil
	})
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("cancel booking: %w", err)
	}
	return cancelled, nil
}
