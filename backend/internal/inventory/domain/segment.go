// Package domain contains seat inventory rules for a train trip.
package domain

import "errors"

var ErrInvalidSegment = errors.New("segment start must be before segment end")

// Segment is a half-open interval of stop indexes: [From, To).
// A passenger travelling from stop 1 to stop 4 occupies legs 1, 2, and 3.
type Segment struct {
	from int
	to   int
}

func NewSegment(from, to int) (Segment, error) {
	if from < 0 || to <= from {
		return Segment{}, ErrInvalidSegment
	}
	return Segment{from: from, to: to}, nil
}

func (s Segment) From() int { return s.from }
func (s Segment) To() int   { return s.to }

func (s Segment) Overlaps(other Segment) bool {
	return s.from < other.to && other.from < s.to
}
