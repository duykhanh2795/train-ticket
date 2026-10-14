package application

import (
	"context"
	"errors"
	"fmt"

	bookingdomain "example.com/train-ticket/internal/booking/domain"
)

type ExpireHolds struct {
	bookings  BookingRepository
	expire    *ExpireBooking
	clock     Clock
	batchSize int
}

func NewExpireHolds(bookings BookingRepository, expire *ExpireBooking, clock Clock, batchSize int) (*ExpireHolds, error) {
	if bookings == nil || expire == nil || clock == nil || batchSize <= 0 {
		return nil, errors.New("invalid expire holds dependencies")
	}
	return &ExpireHolds{bookings: bookings, expire: expire, clock: clock, batchSize: batchSize}, nil
}

// RunOnce expires one bounded batch. It is safe for multiple worker instances:
// each booking is reloaded and locked before its state and reservation change.
func (w *ExpireHolds) RunOnce(ctx context.Context) (int, error) {
	ids, err := w.bookings.ListExpiredHolds(ctx, w.clock.Now(), w.batchSize)
	if err != nil {
		return 0, fmt.Errorf("find expired holds: %w", err)
	}

	expired := 0
	for _, id := range ids {
		if err := w.expire.Execute(ctx, id); err != nil {
			// A confirmation or another worker may have changed the booking after
			// the batch query. The transactional use case is the final authority.
			if errors.Is(err, bookingdomain.ErrInvalidTransition) ||
				errors.Is(err, bookingdomain.ErrHoldNotExpired) ||
				errors.Is(err, ErrBookingNotFound) {
				continue
			}
			return expired, fmt.Errorf("expire booking %q: %w", id, err)
		}
		expired++
	}
	return expired, nil
}
