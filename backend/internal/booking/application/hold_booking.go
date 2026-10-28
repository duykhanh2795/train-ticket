package application

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	bookingdomain "example.com/train-ticket/internal/booking/domain"
)

type HoldBookingCommand struct {
	CustomerID string
	TripID     string
	SeatID     string
	Passengers []HoldPassenger
	FromStop   int
	ToStop     int
}

type HoldPassenger struct {
	SeatID   string
	FullName string
}

const MaxPassengersPerBooking = 6

var ErrInvalidHoldCommand = errors.New("customer, trip, seat, and valid stop range are required")
var ErrTripNotFound = errors.New("trip not found")
var ErrTripUnavailable = errors.New("trip is not available for booking")
var ErrBookingNotFound = errors.New("booking not found")

type HoldBooking struct {
	bookings   BookingRepository
	passengers BookingPassengerRepository
	seatHolds  SeatReservationService
	fares      FareQuote
	outbox     OutboxRepository
	unitOfWork UnitOfWork
	ids        IDGenerator
	clock      Clock
	holdFor    time.Duration
}

func NewHoldBooking(
	bookings BookingRepository,
	passengers BookingPassengerRepository,
	seatHolds SeatReservationService,
	fares FareQuote,
	outbox OutboxRepository,
	unitOfWork UnitOfWork,
	ids IDGenerator,
	clock Clock,
	holdFor time.Duration,
) (*HoldBooking, error) {
	if bookings == nil || passengers == nil || seatHolds == nil || fares == nil || outbox == nil || unitOfWork == nil || ids == nil || clock == nil || holdFor <= 0 {
		return nil, fmt.Errorf("invalid hold booking dependencies")
	}
	return &HoldBooking{
		bookings: bookings, passengers: passengers, seatHolds: seatHolds, fares: fares, outbox: outbox, unitOfWork: unitOfWork,
		ids: ids, clock: clock, holdFor: holdFor,
	}, nil
}

func (uc *HoldBooking) Execute(ctx context.Context, command HoldBookingCommand) (bookingdomain.Booking, error) {
	command.CustomerID = strings.TrimSpace(command.CustomerID)
	command.TripID = strings.TrimSpace(command.TripID)
	legacyRequest := len(command.Passengers) == 0 && strings.TrimSpace(command.SeatID) != ""
	if legacyRequest {
		command.Passengers = []HoldPassenger{{SeatID: command.SeatID}}
	}
	if command.CustomerID == "" || command.TripID == "" ||
		command.FromStop < 0 || command.ToStop <= command.FromStop {
		return bookingdomain.Booking{}, ErrInvalidHoldCommand
	}
	passengers, err := normalizePassengers(command.Passengers, !legacyRequest)
	if err != nil {
		return bookingdomain.Booking{}, err
	}
	id, err := uc.ids.NewID()
	if err != nil {
		return bookingdomain.Booking{}, fmt.Errorf("generate booking ID: %w", err)
	}
	now := uc.clock.Now()
	var booking bookingdomain.Booking
	err = uc.unitOfWork.WithinTransaction(ctx, func(txCtx context.Context) error {
		expiresAt := now.Add(uc.holdFor)
		var fareVND int64
		for _, passenger := range passengers {
			amount, err := uc.fares.QuoteSeat(txCtx, command.TripID, passenger.SeatID, command.FromStop, command.ToStop)
			if err != nil {
				return fmt.Errorf("quote seat fare: %w", err)
			}
			if amount <= 0 || amount > math.MaxInt64-fareVND {
				return ErrInvalidHoldCommand
			}
			fareVND += amount
		}
		booking, err = bookingdomain.NewHeldBooking(id, command.CustomerID, command.TripID, now, expiresAt, fareVND)
		if err != nil {
			return err
		}
		// Save first so the reservation can reference its booking. Both writes
		// are in one transaction, so a failed seat hold rolls this insert back.
		if err := uc.bookings.Create(txCtx, booking, command.FromStop); err != nil {
			return fmt.Errorf("save booking: %w", err)
		}
		for _, passenger := range passengers {
			if err := uc.seatHolds.HoldSeat(txCtx, SeatHoldRequest{
				BookingID: id, TripID: command.TripID, SeatID: passenger.SeatID,
				FromStop: command.FromStop, ToStop: command.ToStop,
				Now: now, ExpiresAt: expiresAt,
			}); err != nil {
				return fmt.Errorf("hold seat %q: %w", passenger.SeatID, err)
			}
			if passenger.FullName != "" {
				if err := uc.passengers.Create(txCtx, id, passenger.SeatID, passenger.FullName); err != nil {
					return fmt.Errorf("save passenger: %w", err)
				}
			}
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

func normalizePassengers(input []HoldPassenger, requireName bool) ([]HoldPassenger, error) {
	if len(input) == 0 || len(input) > MaxPassengersPerBooking {
		return nil, ErrInvalidHoldCommand
	}
	result := make([]HoldPassenger, len(input))
	seen := make(map[string]bool, len(input))
	for index, passenger := range input {
		passenger.SeatID = strings.TrimSpace(passenger.SeatID)
		passenger.FullName = strings.Join(strings.Fields(passenger.FullName), " ")
		nameLength := len([]rune(passenger.FullName))
		if passenger.SeatID == "" || len(passenger.SeatID) > 256 ||
			(requireName && nameLength < 2) || nameLength > 120 || seen[passenger.SeatID] {
			return nil, ErrInvalidHoldCommand
		}
		seen[passenger.SeatID] = true
		result[index] = passenger
	}
	// Every request acquires seat locks in the same order to avoid deadlocks.
	sort.Slice(result, func(i, j int) bool { return result[i].SeatID < result[j].SeatID })
	return result, nil
}
