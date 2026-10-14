package application

import (
	"context"
	"errors"
	"fmt"
)

var ErrInvalidSeatSearch = errors.New("invalid seat search")

type SeatAvailability struct {
	SeatID      string
	CoachNumber string
	SeatNumber  string
	SeatType    string
	Available   bool
}

type SeatAvailabilityRepository interface {
	ListAvailable(ctx context.Context, tripID string, fromStop, toStop int) ([]SeatAvailability, error)
}

type ListSeats struct {
	repository SeatAvailabilityRepository
}

func NewListSeats(repository SeatAvailabilityRepository) (*ListSeats, error) {
	if repository == nil {
		return nil, errors.New("seat availability repository is required")
	}
	return &ListSeats{repository: repository}, nil
}

func (uc *ListSeats) Execute(ctx context.Context, tripID string, fromStop, toStop int) ([]SeatAvailability, error) {
	if tripID == "" || fromStop < 0 || toStop <= fromStop || toStop > 32767 {
		return nil, ErrInvalidSeatSearch
	}
	seats, err := uc.repository.ListAvailable(ctx, tripID, fromStop, toStop)
	if err != nil {
		return nil, fmt.Errorf("list trip seats: %w", err)
	}
	return seats, nil
}
