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
		var err error
		confirmed, err = uc.ConfirmInTransaction(txCtx, bookingID, customerID)
		return err
	})
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("confirm booking: %w", err)
	}
	return confirmed, nil
}

// ConfirmInTransaction joins an existing transaction, so payment settlement,
// seat allocation, booking state and the outbox event commit atomically.
// Callers must lock the booking row before any payment attempt row.
func (uc *ConfirmBooking) ConfirmInTransaction(ctx context.Context, bookingID, customerID string) (bookingdomain.Booking, error) {
	bookingID = strings.TrimSpace(bookingID)
	if bookingID == "" || strings.TrimSpace(customerID) == "" {
		return bookingdomain.Booking{}, ErrInvalidBookingID
	}
	booking, err := uc.bookings.FindForUpdate(ctx, bookingID)
	if err != nil {
		return bookingdomain.Booking{}, err
	}
	if booking.CustomerID() != customerID {
		return bookingdomain.Booking{}, ErrBookingNotFound
	}
	now := uc.clock.Now()
	if err := booking.Confirm(now); err != nil {
		return bookingdomain.Booking{}, err
	}
	if err := uc.reservations.ConfirmSeat(ctx, bookingID, now); err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("confirm seat reservation: %w", err)
	}
	if err := uc.bookings.Update(ctx, booking); err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("update confirmed booking: %w", err)
	}
	event, err := newBookingLifecycleEvent(booking, "booking.confirmed", now)
	if err != nil {
		return bookingdomain.Booking{}, err
	}
	if err := uc.outbox.Enqueue(ctx, event); err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("enqueue booking confirmed event: %w", err)
	}
	return booking, nil
}
