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
	FareVND     *int64
}

type SeatAvailabilityRepository interface {
	ListAvailable(ctx context.Context, tripID string, fromStop, toStop int) ([]SeatAvailability, error)
}

type ListSeats struct {
	repository SeatAvailabilityRepository
	fares      FareQuotes
}

type FareQuotes interface {
	Quotes(ctx context.Context, tripID string, fromStop, toStop int) (map[string]int64, error)
}

func NewListSeats(repository SeatAvailabilityRepository, fares FareQuotes) (*ListSeats, error) {
	if repository == nil || fares == nil {
		return nil, errors.New("seat availability repository and fare quotes are required")
	}
	return &ListSeats{repository: repository, fares: fares}, nil
}

func (uc *ListSeats) Execute(ctx context.Context, tripID string, fromStop, toStop int) ([]SeatAvailability, error) {
	if tripID == "" || fromStop < 0 || toStop <= fromStop || toStop > 32767 {
		return nil, ErrInvalidSeatSearch
	}
	seats, err := uc.repository.ListAvailable(ctx, tripID, fromStop, toStop)
	if err != nil {
		return nil, fmt.Errorf("list trip seats: %w", err)
	}
	quotes, err := uc.fares.Quotes(ctx, tripID, fromStop, toStop)
	if err != nil {
		return nil, fmt.Errorf("quote trip seats: %w", err)
	}
	for i := range seats {
		if fare := quotes[seats[i].SeatType]; fare > 0 {
			seats[i].FareVND = &fare
		}
	}
	return seats, nil
}
