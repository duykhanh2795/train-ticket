package application

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

const (
	DefaultBookingPageSize = 20
	MaxBookingPageSize     = 50
)

var ErrInvalidBookingPage = errors.New("invalid booking page")

// BookingView is a read model for a customer's booking and its journey.
type BookingView struct {
	BookingID          string
	TripID             string
	Status             string
	CreatedAt          time.Time
	ExpiresAt          time.Time
	FareVND            *int64
	TrainNumber        string
	ServiceDate        string
	CoachNumber        string
	SeatNumber         string
	SeatType           string
	FromStop           int
	ToStop             int
	OriginStation      string
	DestinationStation string
	Seats              []BookingSeatView
}

type BookingSeatView struct {
	SeatID      string
	CoachNumber string
	SeatNumber  string
	SeatType    string
	FullName    string
}

type BookingPage struct {
	Items   []BookingView
	HasMore bool
}

type BookingReadRepository interface {
	ListByCustomer(ctx context.Context, customerID string, limit, offset int) ([]BookingView, error)
	FindByCustomer(ctx context.Context, customerID, bookingID string) (BookingView, error)
}

type ReadBookings struct {
	repository BookingReadRepository
}

func NewReadBookings(repository BookingReadRepository) (*ReadBookings, error) {
	if repository == nil {
		return nil, errors.New("booking read repository is required")
	}
	return &ReadBookings{repository: repository}, nil
}

func (uc *ReadBookings) List(ctx context.Context, customerID string, limit, offset int) (BookingPage, error) {
	if strings.TrimSpace(customerID) == "" || limit < 1 || limit > MaxBookingPageSize || offset < 0 || offset > math.MaxInt32 {
		return BookingPage{}, ErrInvalidBookingPage
	}
	items, err := uc.repository.ListByCustomer(ctx, customerID, limit+1, offset)
	if err != nil {
		return BookingPage{}, fmt.Errorf("list customer bookings: %w", err)
	}
	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}
	return BookingPage{Items: items, HasMore: hasMore}, nil
}

func (uc *ReadBookings) Get(ctx context.Context, customerID, bookingID string) (BookingView, error) {
	if strings.TrimSpace(customerID) == "" || strings.TrimSpace(bookingID) == "" {
		return BookingView{}, ErrInvalidBookingID
	}
	view, err := uc.repository.FindByCustomer(ctx, customerID, bookingID)
	if err != nil {
		return BookingView{}, fmt.Errorf("get customer booking: %w", err)
	}
	return view, nil
}
