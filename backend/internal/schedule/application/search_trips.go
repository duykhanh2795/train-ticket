package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrInvalidTripSearch = errors.New("invalid trip search")

// TripSearchQuery contains the criteria for the schedule read use case.
type TripSearchQuery struct {
	OriginStationID      string
	DestinationStationID string
	ServiceDate          time.Time
}

// TripSearchResult is a read model, not a domain entity. Search does not need
// to load a TrainTrip aggregate just to return a list of matching journeys.
type TripSearchResult struct {
	TripID      string
	TrainNumber string
	ServiceDate time.Time
	FromStop    int
	ToStop      int
	DepartureAt time.Time
	ArrivalAt   time.Time
}

// TripSearchRepository is the output port used by the search use case.
type TripSearchRepository interface {
	Search(ctx context.Context, query TripSearchQuery) ([]TripSearchResult, error)
}

type SearchTrips struct {
	repository TripSearchRepository
}

func NewSearchTrips(repository TripSearchRepository) (*SearchTrips, error) {
	if repository == nil {
		return nil, errors.New("trip search repository is required")
	}
	return &SearchTrips{repository: repository}, nil
}

func (uc *SearchTrips) Execute(ctx context.Context, query TripSearchQuery) ([]TripSearchResult, error) {
	query.OriginStationID = strings.TrimSpace(query.OriginStationID)
	query.DestinationStationID = strings.TrimSpace(query.DestinationStationID)
	if query.OriginStationID == "" || query.DestinationStationID == "" ||
		query.OriginStationID == query.DestinationStationID || query.ServiceDate.IsZero() {
		return nil, ErrInvalidTripSearch
	}

	// The database column is DATE; normalize the query to a calendar date so
	// callers' timezone offsets cannot accidentally move it to another day.
	query.ServiceDate = time.Date(
		query.ServiceDate.Year(), query.ServiceDate.Month(), query.ServiceDate.Day(),
		0, 0, 0, 0, time.UTC,
	)

	results, err := uc.repository.Search(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("search trips: %w", err)
	}
	return results, nil
}
