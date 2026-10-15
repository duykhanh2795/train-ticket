package application

import (
	"context"
	"errors"
	"fmt"
	"math"
)

var ErrFareUnavailable = errors.New("fare is not configured for this journey")
var ErrInvalidFareRequest = errors.New("invalid fare request")
var ErrSeatNotFound = errors.New("seat not found for this trip")

type SegmentFare struct {
	SeatType  string
	FromStop  int
	AmountVND int64
}

type FareRepository interface {
	ListSegmentFares(context.Context, string, int, int) ([]SegmentFare, error)
	SeatType(context.Context, string, string) (string, error)
}

type Quote struct{ repository FareRepository }

func NewQuote(repository FareRepository) (*Quote, error) {
	if repository == nil {
		return nil, errors.New("fare repository is required")
	}
	return &Quote{repository: repository}, nil
}

// Quotes returns a price only for seat types with a complete fare for every
// adjacent segment in [fromStop, toStop). Amounts are integer VND.
func (q *Quote) Quotes(ctx context.Context, tripID string, fromStop, toStop int) (map[string]int64, error) {
	if tripID == "" || fromStop < 0 || toStop <= fromStop || toStop > math.MaxInt16 {
		return nil, ErrInvalidFareRequest
	}
	fares, err := q.repository.ListSegmentFares(ctx, tripID, fromStop, toStop)
	if err != nil {
		return nil, fmt.Errorf("load segment fares: %w", err)
	}
	byType := make(map[string]map[int]int64)
	for _, fare := range fares {
		if fare.AmountVND <= 0 || fare.FromStop < fromStop || fare.FromStop >= toStop {
			return nil, ErrFareUnavailable
		}
		if byType[fare.SeatType] == nil {
			byType[fare.SeatType] = make(map[int]int64)
		}
		byType[fare.SeatType][fare.FromStop] = fare.AmountVND
	}
	quotes := make(map[string]int64)
	for seatType, segments := range byType {
		var total int64
		complete := true
		for stop := fromStop; stop < toStop; stop++ {
			amount := segments[stop]
			if amount == 0 || amount > math.MaxInt64-total {
				complete = false
				break
			}
			total += amount
		}
		if complete {
			quotes[seatType] = total
		}
	}
	return quotes, nil
}

func (q *Quote) QuoteSeat(ctx context.Context, tripID, seatID string, fromStop, toStop int) (int64, error) {
	if seatID == "" {
		return 0, ErrInvalidFareRequest
	}
	quotes, err := q.Quotes(ctx, tripID, fromStop, toStop)
	if err != nil {
		return 0, err
	}
	seatType, err := q.repository.SeatType(ctx, tripID, seatID)
	if err != nil {
		return 0, fmt.Errorf("load seat type: %w", err)
	}
	amount := quotes[seatType]
	if amount == 0 {
		return 0, ErrFareUnavailable
	}
	return amount, nil
}
