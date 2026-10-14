package app

import (
	"errors"
	"time"

	bookingpostgres "example.com/train-ticket/internal/booking/adapters/outbound/postgres"
	bookingapp "example.com/train-ticket/internal/booking/application"
	platformclock "example.com/train-ticket/internal/platform/clock"
	platformid "example.com/train-ticket/internal/platform/id"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewOutboxDispatcher(pool *pgxpool.Pool, publisher bookingapp.EventPublisher) (*bookingapp.DispatchOutbox, error) {
	if publisher == nil {
		return nil, errors.New("booking event publisher is required")
	}
	repository, err := bookingpostgres.NewOutboxRepository(pool)
	if err != nil {
		return nil, err
	}
	owner, err := (platformid.UUIDGenerator{}).NewID()
	if err != nil {
		return nil, err
	}
	// Lease one event at a time so a slow publish cannot exhaust the leases of
	// an entire queued batch. Publish timeout is shorter than this lease.
	return bookingapp.NewDispatchOutbox(repository, publisher, owner, platformclock.SystemClock{}, 1, 30*time.Second)
}
