package application

import (
	"encoding/json"
	"fmt"
	"time"

	bookingdomain "example.com/train-ticket/internal/booking/domain"
)

func newBookingLifecycleEvent(booking bookingdomain.Booking, eventType string, occurredAt time.Time) (OutboxMessage, error) {
	payload, err := json.Marshal(struct {
		EventID    string    `json:"event_id"`
		EventType  string    `json:"event_type"`
		BookingID  string    `json:"booking_id"`
		CustomerID string    `json:"customer_id"`
		TripID     string    `json:"trip_id"`
		Status     string    `json:"status"`
		FareVND    int64     `json:"fare_vnd"`
		OccurredAt time.Time `json:"occurred_at"`
	}{
		EventID:    fmt.Sprintf("%s:%s", booking.ID(), eventType),
		EventType:  eventType,
		BookingID:  booking.ID(),
		CustomerID: booking.CustomerID(),
		TripID:     booking.TripID(),
		Status:     booking.Status().String(),
		FareVND:    booking.FareVND(),
		OccurredAt: occurredAt,
	})
	if err != nil {
		return OutboxMessage{}, fmt.Errorf("encode booking event: %w", err)
	}
	return OutboxMessage{
		ID:            fmt.Sprintf("%s:%s", booking.ID(), eventType),
		AggregateType: "booking",
		AggregateID:   booking.ID(),
		EventType:     eventType,
		Payload:       payload,
		OccurredAt:    occurredAt,
	}, nil
}
