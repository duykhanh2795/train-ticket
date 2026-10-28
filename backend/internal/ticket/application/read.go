package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var ErrTicketBookingNotFound = errors.New("ticket booking not found")
var ErrTicketsUnavailable = errors.New("tickets are not available for this booking")
var ErrTicketsMissing = errors.New("confirmed booking has no issued tickets")

type TicketReadRepository interface {
	BookingStatus(ctx context.Context, bookingID, customerID string) (string, error)
	ListByBooking(ctx context.Context, bookingID, customerID string) ([]TicketView, error)
}

type ReadTickets struct {
	repository TicketReadRepository
}

func NewReadTickets(repository TicketReadRepository) (*ReadTickets, error) {
	if repository == nil {
		return nil, errors.New("ticket read repository is required")
	}
	return &ReadTickets{repository: repository}, nil
}

func (uc *ReadTickets) List(ctx context.Context, bookingID, customerID string) ([]TicketView, error) {
	if strings.TrimSpace(bookingID) == "" || strings.TrimSpace(customerID) == "" {
		return nil, ErrTicketBookingNotFound
	}
	status, err := uc.repository.BookingStatus(ctx, bookingID, customerID)
	if err != nil {
		return nil, fmt.Errorf("check ticket booking: %w", err)
	}
	if status != "confirmed" {
		return nil, ErrTicketsUnavailable
	}
	tickets, err := uc.repository.ListByBooking(ctx, bookingID, customerID)
	if err != nil {
		return nil, fmt.Errorf("list booking tickets: %w", err)
	}
	if len(tickets) == 0 {
		return nil, ErrTicketsMissing
	}
	return tickets, nil
}
