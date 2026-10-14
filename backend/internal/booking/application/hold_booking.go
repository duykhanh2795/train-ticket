package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	bookingdomain "example.com/train-ticket/internal/booking/domain"
)

type HoldBookingCommand struct {
	CustomerID string
	TripID     string
	SeatID     string
	FromStop   int
	ToStop     int
}

var ErrInvalidHoldCommand = errors.New("customer, trip, seat, and valid stop range are required")
var ErrTripNotFound = errors.New("trip not found")
var ErrBookingNotFound = errors.New("booking not found")

type HoldBooking struct {
	bookings   BookingRepository
	seatHolds  SeatReservationService
	outbox     OutboxRepository
	unitOfWork UnitOfWork
	ids        IDGenerator
	clock      Clock
	holdFor    time.Duration
}

func NewHoldBooking(
	bookings BookingRepository,
	seatHolds SeatReservationService,
	outbox OutboxRepository,
	unitOfWork UnitOfWork,
	ids IDGenerator,
	clock Clock,
	holdFor time.Duration,
) (*HoldBooking, error) {
	if bookings == nil || seatHolds == nil || outbox == nil || unitOfWork == nil || ids == nil || clock == nil || holdFor <= 0 {
		return nil, fmt.Errorf("invalid hold booking dependencies")
	}
	return &HoldBooking{
		bookings: bookings, seatHolds: seatHolds, outbox: outbox, unitOfWork: unitOfWork,
		ids: ids, clock: clock, holdFor: holdFor,
	}, nil
}

func (uc *HoldBooking) Execute(ctx context.Context, command HoldBookingCommand) (bookingdomain.Booking, error) {
	command.CustomerID = strings.TrimSpace(command.CustomerID)
	command.TripID = strings.TrimSpace(command.TripID)
	command.SeatID = strings.TrimSpace(command.SeatID)
	if command.CustomerID == "" || command.TripID == "" || command.SeatID == "" ||
		command.FromStop < 0 || command.ToStop <= command.FromStop {
		return bookingdomain.Booking{}, ErrInvalidHoldCommand
	}
	id, err := uc.ids.NewID()
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("generate booking ID: %w", err)
	}
	now := uc.clock.Now()
	booking, err := bookingdomain.NewHeldBooking(
		id, command.CustomerID, command.TripID, now, now.Add(uc.holdFor),
	)
	if err != nil {
		return bookingdomain.Booking{}, err
	}

	err = uc.unitOfWork.WithinTransaction(ctx, func(txCtx context.Context) error {
		expiresAt := now.Add(uc.holdFor)
		// Save first so the reservation can reference its booking. Both writes
		// are in one transaction, so a failed seat hold rolls this insert back.
		if err := uc.bookings.Create(txCtx, booking); err != nil {
			return fmt.Errorf("save booking: %w", err)
		}
		if err := uc.seatHolds.HoldSeat(txCtx, SeatHoldRequest{
			BookingID: id,
			TripID:    command.TripID,
			SeatID:    command.SeatID,
			FromStop:  command.FromStop,
			ToStop:    command.ToStop,
			Now:       now,
			ExpiresAt: expiresAt,
		}); err != nil {
			return fmt.Errorf("hold seat: %w", err)
		}
		event, err := newBookingLifecycleEvent(booking, "booking.held", now)
		if err != nil {
			return err
		}
		if err := uc.outbox.Enqueue(txCtx, event); err != nil {
			return fmt.Errorf("enqueue booking held event: %w", err)
		}
		return nil
	})
	if err != nil {
		return bookingdomain.Booking{}, err
	}
	return booking, nil
}
