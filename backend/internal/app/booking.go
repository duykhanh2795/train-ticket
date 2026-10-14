package app

import (
	"example.com/train-ticket/internal/booking/adapters/outbound/inventory"
	bookingpostgres "example.com/train-ticket/internal/booking/adapters/outbound/postgres"
	bookingapp "example.com/train-ticket/internal/booking/application"
	"example.com/train-ticket/internal/config"
	inventorypostgres "example.com/train-ticket/internal/inventory/adapters/outbound/postgres"
	inventoryapp "example.com/train-ticket/internal/inventory/application"
	platformclock "example.com/train-ticket/internal/platform/clock"
	platformid "example.com/train-ticket/internal/platform/id"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BookingModule struct {
	HoldBooking    *bookingapp.HoldBooking
	ConfirmBooking *bookingapp.ConfirmBooking
	ExpireHolds    *bookingapp.ExpireHolds
}

// NewBookingModule is the composition root for booking and inventory use cases.
func NewBookingModule(cfg config.Config, pool *pgxpool.Pool) (BookingModule, error) {
	bookingRepository, err := bookingpostgres.NewBookingRepository(pool)
	if err != nil {
		return BookingModule{}, err
	}
	outboxRepository, err := bookingpostgres.NewOutboxRepository(pool)
	if err != nil {
		return BookingModule{}, err
	}
	inventoryRepository, err := inventorypostgres.NewInventoryRepository(pool)
	if err != nil {
		return BookingModule{}, err
	}
	unitOfWork, err := bookingpostgres.NewUnitOfWork(pool)
	if err != nil {
		return BookingModule{}, err
	}
	inventoryService, err := inventoryapp.NewSeatReservationService(inventoryRepository)
	if err != nil {
		return BookingModule{}, err
	}
	reservations := inventory.NewSeatReservationService(inventoryService)
	clock := platformclock.SystemClock{}

	holdBooking, err := bookingapp.NewHoldBooking(
		bookingRepository,
		reservations,
		outboxRepository,
		unitOfWork,
		platformid.UUIDGenerator{},
		clock,
		cfg.BookingHoldDuration,
	)
	if err != nil {
		return BookingModule{}, err
	}
	confirmBooking, err := bookingapp.NewConfirmBooking(bookingRepository, reservations, outboxRepository, unitOfWork, clock)
	if err != nil {
		return BookingModule{}, err
	}
	expireBooking, err := bookingapp.NewExpireBooking(bookingRepository, reservations, outboxRepository, unitOfWork, clock)
	if err != nil {
		return BookingModule{}, err
	}
	expireHolds, err := bookingapp.NewExpireHolds(bookingRepository, expireBooking, clock, 100)
	if err != nil {
		return BookingModule{}, err
	}
	return BookingModule{
		HoldBooking:    holdBooking,
		ConfirmBooking: confirmBooking,
		ExpireHolds:    expireHolds,
	}, nil
}
