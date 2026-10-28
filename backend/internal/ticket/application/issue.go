package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"example.com/train-ticket/internal/ticket/domain"
)

var ErrTicketNotIssued = errors.New("ticket could not be issued")

type TicketRepository interface {
	HasTicketPassengers(ctx context.Context, bookingID string) (bool, error)
	ListSeatIDs(ctx context.Context, bookingID string) ([]string, error)
	Create(ctx context.Context, ticket domain.Ticket) (bool, error)
}

type IDGenerator interface {
	NewID() (string, error)
}

type Clock interface {
	Now() time.Time
}

type IssueTickets struct {
	tickets TicketRepository
	ids     IDGenerator
	clock   Clock
}

func NewIssueTickets(tickets TicketRepository, ids IDGenerator, clock Clock) (*IssueTickets, error) {
	if tickets == nil || ids == nil || clock == nil {
		return nil, errors.New("ticket issuance dependencies are required")
	}
	return &IssueTickets{tickets: tickets, ids: ids, clock: clock}, nil
}

// Ready reports whether every reserved seat has a passenger for ticket issuance.
func (uc *IssueTickets) Ready(ctx context.Context, bookingID string) (bool, error) {
	if strings.TrimSpace(bookingID) == "" {
		return false, nil
	}
	return uc.tickets.HasTicketPassengers(ctx, bookingID)
}

// IssueInTransaction joins the verified payment settlement transaction after
// the booking and its seat reservations have been confirmed.
func (uc *IssueTickets) IssueInTransaction(ctx context.Context, bookingID string) error {
	bookingID = strings.TrimSpace(bookingID)
	if bookingID == "" {
		return ErrTicketNotIssued
	}

	seatIDs, err := uc.tickets.ListSeatIDs(ctx, bookingID)
	if err != nil {
		return fmt.Errorf("list seats for booking %q: %w", bookingID, err)
	}
	if len(seatIDs) == 0 {
		return fmt.Errorf("booking %q has no confirmed passenger seats: %w", bookingID, ErrTicketNotIssued)
	}

	issuedAt := uc.clock.Now().UTC()
	for _, seatID := range seatIDs {
		id, err := uc.ids.NewID()
		if err != nil {
			return fmt.Errorf("generate ticket ID for booking %q: %w", bookingID, err)
		}
		ticket, err := domain.NewTicket(id, bookingID, seatID, issuedAt)
		if err != nil {
			return fmt.Errorf("prepare ticket for booking %q seat %q: %w", bookingID, seatID, err)
		}
		created, err := uc.tickets.Create(ctx, ticket)
		if err != nil {
			return fmt.Errorf("issue ticket for booking %q seat %q: %w", bookingID, seatID, err)
		}
		if !created {
			return fmt.Errorf("booking %q seat %q: %w", bookingID, seatID, ErrTicketNotIssued)
		}
	}
	return nil
}
