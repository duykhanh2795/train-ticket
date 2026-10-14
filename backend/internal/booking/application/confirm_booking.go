package application

import (
	"context"
	"errors"
	"fmt"
	"strings"

	bookingdomain "example.com/train-ticket/internal/booking/domain"
)

var ErrInvalidBookingID = errors.New("booking ID is required")

type ConfirmBooking struct {
	bookings     BookingRepository
	reservations SeatReservationService
	outbox       OutboxRepository
	unitOfWork   UnitOfWork
	clock        Clock
}

func NewConfirmBooking(
	bookings BookingRepository,
	reservations SeatReservationService,
	outbox OutboxRepository,
	unitOfWork UnitOfWork,
	clock Clock,
) (*ConfirmBooking, error) {
	if bookings == nil || reservations == nil || outbox == nil || unitOfWork == nil || clock == nil {
		return nil, errors.New("invalid confirm booking dependencies")
	}
	return &ConfirmBooking{bookings: bookings, reservations: reservations, outbox: outbox, unitOfWork: unitOfWork, clock: clock}, nil
}

func (uc *ConfirmBooking) Execute(ctx context.Context, bookingID, customerID string) (bookingdomain.Booking, error) {
	bookingID = strings.TrimSpace(bookingID)
	if bookingID == "" || strings.TrimSpace(customerID) == "" {
		return bookingdomain.Booking{}, ErrInvalidBookingID
	}

	var confirmed bookingdomain.Booking
	err := uc.unitOfWork.WithinTransaction(ctx, func(txCtx context.Context) error {
		booking, err := uc.bookings.FindForUpdate(txCtx, bookingID)
		if err != nil {
			return err
		}
		if booking.CustomerID() != customerID {
			return ErrBookingNotFound
		}
		now := uc.clock.Now()
		if err := booking.Confirm(now); err != nil {
			return err
		}
		if err := uc.reservations.ConfirmSeat(txCtx, bookingID, now); err != nil {
			return fmt.Errorf("confirm seat reservation: %w", err)
		}
		if err := uc.bookings.Update(txCtx, booking); err != nil {
			return fmt.Errorf("update confirmed booking: %w", err)
		}
		event, err := newBookingLifecycleEvent(booking, "booking.confirmed", now)
		if err != nil {
			return err
		}
		if err := uc.outbox.Enqueue(txCtx, event); err != nil {
			return fmt.Errorf("enqueue booking confirmed event: %w", err)
		}
		confirmed = booking
		return nil
	})
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("confirm booking: %w", err)
	}
	return confirmed, nil
}
