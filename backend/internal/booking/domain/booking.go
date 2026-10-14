// Package domain contains booking invariants and state transitions.
package domain

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidBooking    = errors.New("invalid booking")
	ErrInvalidTransition = errors.New("invalid booking state transition")
	ErrHoldExpired       = errors.New("booking hold has expired")
	ErrHoldNotExpired    = errors.New("booking hold has not expired")
)

type Status uint8

const (
	StatusHeld Status = iota + 1
	StatusConfirmed
	StatusCancelled
	StatusExpired
)

func (s Status) String() string {
	switch s {
	case StatusHeld:
		return "held"
	case StatusConfirmed:
		return "confirmed"
	case StatusCancelled:
		return "cancelled"
	case StatusExpired:
		return "expired"
	default:
		return "unknown"
	}
}

type Booking struct {
	id         string
	customerID string
	tripID     string
	status     Status
	expiresAt  time.Time
	createdAt  time.Time
}

func NewHeldBooking(id, customerID, tripID string, createdAt, expiresAt time.Time) (Booking, error) {
	if strings.TrimSpace(id) == "" || strings.TrimSpace(customerID) == "" || strings.TrimSpace(tripID) == "" {
		return Booking{}, ErrInvalidBooking
	}
	if !expiresAt.After(createdAt) {
		return Booking{}, ErrInvalidBooking
	}

	return Booking{
		id:         id,
		customerID: customerID,
		tripID:     tripID,
		status:     StatusHeld,
		createdAt:  createdAt,
		expiresAt:  expiresAt,
	}, nil
}

// RestoreBooking rebuilds an aggregate from persisted state after validating its invariants.
func RestoreBooking(id, customerID, tripID string, status Status, createdAt, expiresAt time.Time) (Booking, error) {
	if strings.TrimSpace(id) == "" || strings.TrimSpace(customerID) == "" || strings.TrimSpace(tripID) == "" {
		return Booking{}, ErrInvalidBooking
	}
	if status < StatusHeld || status > StatusExpired || !expiresAt.After(createdAt) {
		return Booking{}, ErrInvalidBooking
	}
	return Booking{
		id: id, customerID: customerID, tripID: tripID,
		status: status, createdAt: createdAt, expiresAt: expiresAt,
	}, nil
}

func (b *Booking) Confirm(at time.Time) error {
	if b.status != StatusHeld {
		return ErrInvalidTransition
	}
	if !at.Before(b.expiresAt) {
		return ErrHoldExpired
	}
	b.status = StatusConfirmed
	return nil
}

func (b *Booking) Expire(at time.Time) error {
	if b.status != StatusHeld {
		return ErrInvalidTransition
	}
	if at.Before(b.expiresAt) {
		return ErrHoldNotExpired
	}
	b.status = StatusExpired
	return nil
}

func (b *Booking) Cancel() error {
	if b.status != StatusHeld && b.status != StatusConfirmed {
		return ErrInvalidTransition
	}
	b.status = StatusCancelled
	return nil
}

func (b Booking) ID() string           { return b.id }
func (b Booking) CustomerID() string   { return b.customerID }
func (b Booking) TripID() string       { return b.tripID }
func (b Booking) Status() Status       { return b.status }
func (b Booking) ExpiresAt() time.Time { return b.expiresAt }
func (b Booking) CreatedAt() time.Time { return b.createdAt }
