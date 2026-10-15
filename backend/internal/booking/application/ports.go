package application

import (
	"context"
	"time"

	bookingdomain "example.com/train-ticket/internal/booking/domain"
)

type BookingRepository interface {
	Create(ctx context.Context, booking bookingdomain.Booking) error
	FindForUpdate(ctx context.Context, bookingID string) (bookingdomain.Booking, error)
	Update(ctx context.Context, booking bookingdomain.Booking) error
	ListExpiredHolds(ctx context.Context, at time.Time, limit int) ([]string, error)
}

type BookingPassengerRepository interface {
	Create(ctx context.Context, bookingID, seatID, fullName string) error
}

type SeatReservationService interface {
	HoldSeat(ctx context.Context, request SeatHoldRequest) error
	ConfirmSeat(ctx context.Context, bookingID string, at time.Time) error
	ReleaseSeat(ctx context.Context, bookingID string) error
}

type FareQuote interface {
	QuoteSeat(ctx context.Context, tripID, seatID string, fromStop, toStop int) (int64, error)
}

type SeatHoldRequest struct {
	BookingID string
	TripID    string
	SeatID    string
	FromStop  int
	ToStop    int
	Now       time.Time
	ExpiresAt time.Time
}

type UnitOfWork interface {
	WithinTransaction(ctx context.Context, fn func(context.Context) error) error
}

type IDGenerator interface {
	NewID() (string, error)
}

type Clock interface {
	Now() time.Time
}

// OutboxMessage is a durable integration event waiting to be published.
type OutboxMessage struct {
	ID            string
	AggregateType string
	AggregateID   string
	EventType     string
	Payload       []byte
	OccurredAt    time.Time
	Attempts      int
}

// OutboxRepository stores events in the same transaction as booking changes,
// then leases pending rows to a background dispatcher.
type OutboxRepository interface {
	Enqueue(ctx context.Context, message OutboxMessage) error
	Claim(ctx context.Context, owner string, now, leaseUntil time.Time, limit int) ([]OutboxMessage, error)
	MarkPublished(ctx context.Context, id, owner string, at time.Time) error
	MarkFailed(ctx context.Context, id, owner string, at time.Time, cause error) error
}

type EventPublisher interface {
	Publish(ctx context.Context, message OutboxMessage) error
}
