package application

import (
	"context"
	"time"

	"example.com/train-ticket/internal/payment/domain"
)

// BookingGateway is implemented in-process by the booking context. Lock must
// use the transaction in ctx; confirmation must join that same transaction.
type BookingGateway interface {
	Lock(context.Context, string) (BookingSnapshot, error)
	Confirm(context.Context, string, string) error
}

type TicketEligibility interface {
	Ready(context.Context, string) (bool, error)
}

// TicketIssuer joins the payment transaction after booking confirmation.
type TicketIssuer interface {
	TicketEligibility
	IssueInTransaction(context.Context, string) error
}

type BookingSnapshot struct {
	ID         string
	CustomerID string
	Status     string
	FareVND    int64
	ExpiresAt  time.Time
}

type AttemptRepository interface {
	Create(context.Context, string, int64, time.Time, time.Time) (domain.Attempt, error)
	SaveCheckoutURL(context.Context, int64, string) error
	FindPendingForBooking(context.Context, string) (domain.Attempt, error)
	FindByID(context.Context, int64) (domain.Attempt, error)
	FindOwnedByID(context.Context, int64, string) (domain.Attempt, error)
	FindForUpdate(context.Context, int64) (domain.Attempt, error)
	Settle(context.Context, domain.Attempt) error
}

type UnitOfWork interface {
	WithinTransaction(context.Context, func(context.Context) error) error
}

type Gateway interface {
	CheckoutURL(domain.CheckoutRequest) (string, error)
}

type Clock interface {
	Now() time.Time
}
