package domain

import (
	"errors"
	"strings"
	"time"
)

var ErrInvalidTicket = errors.New("invalid ticket")

// Ticket represents a ticket issued for one seat in a confirmed booking.
type Ticket struct {
	id        string
	bookingID string
	seatID    string
	issuedAt  time.Time
}

func NewTicket(id, bookingID, seatID string, issuedAt time.Time) (Ticket, error) {
	if strings.TrimSpace(id) == "" || strings.TrimSpace(bookingID) == "" || strings.TrimSpace(seatID) == "" || issuedAt.IsZero() {
		return Ticket{}, ErrInvalidTicket
	}
	return Ticket{id: id, bookingID: bookingID, seatID: seatID, issuedAt: issuedAt.UTC()}, nil
}

func (t Ticket) ID() string          { return t.id }
func (t Ticket) BookingID() string   { return t.bookingID }
func (t Ticket) SeatID() string      { return t.seatID }
func (t Ticket) IssuedAt() time.Time { return t.issuedAt }
