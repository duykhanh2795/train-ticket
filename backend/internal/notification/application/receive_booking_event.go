package application

import (
	"context"
	"errors"
	"strings"
	"time"
)

// BookingEvent is notification's own inbound integration contract.
type BookingEvent struct {
	EventID    string    `json:"event_id"`
	EventType  string    `json:"event_type"`
	BookingID  string    `json:"booking_id"`
	CustomerID string    `json:"customer_id"`
	TripID     string    `json:"trip_id"`
	Status     string    `json:"status"`
	OccurredAt time.Time `json:"occurred_at"`
}

var ErrInvalidEvent = errors.New("invalid booking integration event")

type InboxRepository interface {
	// Accept atomically records the inbox marker and creates one notification job.
	Accept(context.Context, string, BookingEvent) (bool, error)
}

type ReceiveBookingEvent struct {
	inbox    InboxRepository
	consumer string
}

func NewReceiveBookingEvent(inbox InboxRepository, consumer string) (*ReceiveBookingEvent, error) {
	if inbox == nil || strings.TrimSpace(consumer) == "" {
		return nil, errors.New("notification inbox and consumer name are required")
	}
	return &ReceiveBookingEvent{inbox: inbox, consumer: consumer}, nil
}

func (u *ReceiveBookingEvent) Execute(ctx context.Context, event BookingEvent) (bool, error) {
	status := map[string]string{"booking.held": "held", "booking.confirmed": "confirmed", "booking.expired": "expired", "booking.cancelled": "cancelled"}[event.EventType]
	if status == "" || event.Status != status || event.EventID != event.BookingID+":"+event.EventType ||
		strings.TrimSpace(event.BookingID) == "" || strings.TrimSpace(event.CustomerID) == "" ||
		strings.TrimSpace(event.TripID) == "" || event.OccurredAt.IsZero() {
		return false, ErrInvalidEvent
	}
	return u.inbox.Accept(ctx, u.consumer, event)
}
