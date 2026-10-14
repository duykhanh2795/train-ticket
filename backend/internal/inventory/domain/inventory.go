package domain

import (
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidInventory          = errors.New("trip, seat, and stop count are required")
	ErrSeatNotFound              = errors.New("seat does not exist on this trip")
	ErrSeatUnavailable           = errors.New("seat is unavailable for the requested segment")
	ErrReservationNotFound       = errors.New("seat reservation not found")
	ErrReservationNotConfirmable = errors.New("seat reservation cannot be confirmed")
)

type ReservationStatus uint8

const (
	ReservationHeld ReservationStatus = iota + 1
	ReservationConfirmed
	ReservationReleased
)

type reservation struct {
	bookingID string
	segment   Segment
	status    ReservationStatus
	expiresAt time.Time
}

type ReservationSnapshot struct {
	BookingID string
	Segment   Segment
	Status    ReservationStatus
	ExpiresAt time.Time
}

// SeatInventory is the aggregate root for one seat on one trip.
type SeatInventory struct {
	tripID       string
	seatID       string
	stopCount    int
	reservations []reservation
}

func NewSeatInventory(tripID, seatID string, stopCount int) (SeatInventory, error) {
	if strings.TrimSpace(tripID) == "" || strings.TrimSpace(seatID) == "" || stopCount < 2 {
		return SeatInventory{}, ErrInvalidInventory
	}
	return SeatInventory{tripID: tripID, seatID: seatID, stopCount: stopCount}, nil
}

// RestoreSeatInventory reconstructs an aggregate from persistence while rechecking invariants.
func RestoreSeatInventory(tripID, seatID string, stopCount int, snapshots []ReservationSnapshot) (SeatInventory, error) {
	inventory, err := NewSeatInventory(tripID, seatID, stopCount)
	if err != nil {
		return SeatInventory{}, err
	}
	for _, snapshot := range snapshots {
		segment, err := NewSegment(snapshot.Segment.From(), snapshot.Segment.To())
		if err != nil || segment.To() >= inventory.stopCount || strings.TrimSpace(snapshot.BookingID) == "" ||
			snapshot.Status < ReservationHeld || snapshot.Status > ReservationReleased {
			return SeatInventory{}, ErrInvalidInventory
		}
		inventory.reservations = append(inventory.reservations, reservation{
			bookingID: snapshot.BookingID,
			segment:   segment,
			status:    snapshot.Status,
			expiresAt: snapshot.ExpiresAt,
		})
	}
	return inventory, nil
}

func (i *SeatInventory) Hold(bookingID string, segment Segment, now, expiresAt time.Time) error {
	if strings.TrimSpace(bookingID) == "" || !expiresAt.After(now) {
		return ErrInvalidInventory
	}
	if segment.To() >= i.stopCount {
		return ErrInvalidSegment
	}

	for _, existing := range i.reservations {
		if existing.bookingID == bookingID && existing.status != ReservationReleased {
			return ErrSeatUnavailable
		}
		if existing.segment.Overlaps(segment) && existing.blocks(now) {
			return ErrSeatUnavailable
		}
	}

	i.reservations = append(i.reservations, reservation{
		bookingID: bookingID,
		segment:   segment,
		status:    ReservationHeld,
		expiresAt: expiresAt,
	})
	return nil
}

func (i *SeatInventory) Confirm(bookingID string, at time.Time) error {
	for index := range i.reservations {
		current := &i.reservations[index]
		if current.bookingID != bookingID || current.status == ReservationReleased {
			continue
		}
		if current.status != ReservationHeld || !at.Before(current.expiresAt) {
			return ErrReservationNotConfirmable
		}
		current.status = ReservationConfirmed
		return nil
	}
	return ErrReservationNotFound
}

func (i *SeatInventory) Release(bookingID string) error {
	for index := range i.reservations {
		current := &i.reservations[index]
		if current.bookingID == bookingID && current.status != ReservationReleased {
			current.status = ReservationReleased
			return nil
		}
	}
	return ErrReservationNotFound
}

func (r reservation) blocks(at time.Time) bool {
	if r.status == ReservationConfirmed {
		return true
	}
	return r.status == ReservationHeld && at.Before(r.expiresAt)
}

func (i SeatInventory) TripID() string { return i.tripID }
func (i SeatInventory) SeatID() string { return i.seatID }

func (i SeatInventory) Reservations() []ReservationSnapshot {
	snapshots := make([]ReservationSnapshot, 0, len(i.reservations))
	for _, reservation := range i.reservations {
		snapshots = append(snapshots, ReservationSnapshot{
			BookingID: reservation.bookingID,
			Segment:   reservation.segment,
			Status:    reservation.status,
			ExpiresAt: reservation.expiresAt,
		})
	}
	return snapshots
}
