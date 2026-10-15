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
	FareFromVND *int64
}

type FareQuotes interface {
	Quotes(ctx context.Context, tripID string, fromStop, toStop int) (map[string]int64, error)
}

// TripSearchRepository is the output port used by the search use case.
type TripSearchRepository interface {
	Search(ctx context.Context, query TripSearchQuery) ([]TripSearchResult, error)
}

type SearchTrips struct {
	repository TripSearchRepository
	fares      FareQuotes
}

func NewSearchTrips(repository TripSearchRepository, fares FareQuotes) (*SearchTrips, error) {
	if repository == nil || fares == nil {
		return nil, errors.New("trip search repository and fare quotes are required")
	}
	return &SearchTrips{repository: repository, fares: fares}, nil
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
	for i := range results {
		quotes, err := uc.fares.Quotes(ctx, results[i].TripID, results[i].FromStop, results[i].ToStop)
		if err != nil {
			return nil, fmt.Errorf("quote trip %q: %w", results[i].TripID, err)
		}
		for _, amount := range quotes {
			if results[i].FareFromVND == nil || amount < *results[i].FareFromVND {
				price := amount
				results[i].FareFromVND = &price
			}
		}
	}
	return results, nil
}
