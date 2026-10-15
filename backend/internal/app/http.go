package app

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	bookinghttp "example.com/train-ticket/internal/booking/adapters/inbound/http"
	bookingpostgres "example.com/train-ticket/internal/booking/adapters/outbound/postgres"
	bookingapp "example.com/train-ticket/internal/booking/application"
	"example.com/train-ticket/internal/config"
	inventoryhttp "example.com/train-ticket/internal/inventory/adapters/inbound/http"
	inventorypostgres "example.com/train-ticket/internal/inventory/adapters/outbound/postgres"
	inventoryapp "example.com/train-ticket/internal/inventory/application"
	pricingpostgres "example.com/train-ticket/internal/pricing/adapters/outbound/postgres"
	pricingapp "example.com/train-ticket/internal/pricing/application"
	schedulehttp "example.com/train-ticket/internal/schedule/adapters/inbound/http"
	schedulepostgres "example.com/train-ticket/internal/schedule/adapters/outbound/postgres"
	scheduleapp "example.com/train-ticket/internal/schedule/application"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewHTTPServer(cfg config.Config, logger *slog.Logger, pool *pgxpool.Pool) (*http.Server, error) {
	if logger == nil {
		return nil, errors.New("logger is required")
	}

	tripSearchRepository, err := schedulepostgres.NewTripSearchRepository(pool)
	if err != nil {
		return nil, err
	}
	seatRepository, err := inventorypostgres.NewSeatAvailabilityRepository(pool)
	if err != nil {
		return nil, err
	}
	fareRepository, err := pricingpostgres.NewFareRepository(pool)
	if err != nil {
		return nil, err
	}
	fareQuotes, err := pricingapp.NewQuote(fareRepository)
	if err != nil {
		return nil, err
	}
	searchTrips, err := scheduleapp.NewSearchTrips(tripSearchRepository, fareQuotes)
	if err != nil {
		return nil, err
	}
	searchTripsHandler := schedulehttp.NewSearchTripsHandler(searchTrips)
	listSeats, err := inventoryapp.NewListSeats(seatRepository, fareQuotes)
	if err != nil {
		return nil, err
	}
	listSeatsHandler := inventoryhttp.NewListSeatsHandler(listSeats)
	authHandler, err := NewAuthHandler(pool)
	if err != nil {
		return nil, err
	}

	bookingModule, err := NewBookingModule(cfg, pool)
	if err != nil {
		return nil, err
	}
	bookingHandler := bookinghttp.NewHandler(bookingModule.HoldBooking, bookingModule.ConfirmBooking, bookingModule.CancelBooking, authHandler.RequireSession())
	bookingReadRepository, err := bookingpostgres.NewBookingReadRepository(pool)
	if err != nil {
		return nil, err
	}
	readBookings, err := bookingapp.NewReadBookings(bookingReadRepository)
	if err != nil {
		return nil, err
	}
	bookingReadHandler := bookinghttp.NewReadHandler(readBookings, authHandler.RequireSession())

	return &http.Server{
		Addr:              cfg.HTTPAddress,
		Handler:           transporthttp.NewRouter(logger, searchTripsHandler, listSeatsHandler, authHandler, bookingHandler, bookingReadHandler),
		ReadHeaderTimeout: 5 * time.Second,
	}, nil
}
