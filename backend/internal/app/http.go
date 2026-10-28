package app

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	adminhttp "example.com/train-ticket/internal/admin/adapters/inbound/http"
	adminpostgres "example.com/train-ticket/internal/admin/adapters/outbound/postgres"
	adminapp "example.com/train-ticket/internal/admin/application"
	bookinghttp "example.com/train-ticket/internal/booking/adapters/inbound/http"
	bookingpostgres "example.com/train-ticket/internal/booking/adapters/outbound/postgres"
	bookingapp "example.com/train-ticket/internal/booking/application"
	"example.com/train-ticket/internal/config"
	inventoryhttp "example.com/train-ticket/internal/inventory/adapters/inbound/http"
	inventorypostgres "example.com/train-ticket/internal/inventory/adapters/outbound/postgres"
	inventoryapp "example.com/train-ticket/internal/inventory/application"
	platformclock "example.com/train-ticket/internal/platform/clock"
	platformid "example.com/train-ticket/internal/platform/id"
	pricingpostgres "example.com/train-ticket/internal/pricing/adapters/outbound/postgres"
	pricingapp "example.com/train-ticket/internal/pricing/application"
	schedulehttp "example.com/train-ticket/internal/schedule/adapters/inbound/http"
	schedulepostgres "example.com/train-ticket/internal/schedule/adapters/outbound/postgres"
	scheduleapp "example.com/train-ticket/internal/schedule/application"
	tickethttp "example.com/train-ticket/internal/ticket/adapters/inbound/http"
	ticketpostgres "example.com/train-ticket/internal/ticket/adapters/outbound/postgres"
	ticketapp "example.com/train-ticket/internal/ticket/application"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
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
	adminRepository, err := adminpostgres.NewRepository(pool)
	if err != nil {
		return nil, err
	}
	adminService, err := adminapp.NewService(adminRepository, platformid.UUIDGenerator{}, platformclock.SystemClock{})
	if err != nil {
		return nil, err
	}
	adminHandler := adminhttp.NewHandler(adminService, authHandler.RequireSession())

	bookingModule, err := NewBookingModule(cfg, pool)
	if err != nil {
		return nil, err
	}
	bookingHandler := bookinghttp.NewHandler(bookingModule.HoldBooking, bookingModule.CancelBooking, authHandler.RequireSession())
	bookingReadRepository, err := bookingpostgres.NewBookingReadRepository(pool)
	if err != nil {
		return nil, err
	}
	readBookings, err := bookingapp.NewReadBookings(bookingReadRepository)
	if err != nil {
		return nil, err
	}
	bookingReadHandler := bookinghttp.NewReadHandler(readBookings, authHandler.RequireSession())
	ticketRepository, err := ticketpostgres.NewTicketRepository(pool)
	if err != nil {
		return nil, err
	}
	readTickets, err := ticketapp.NewReadTickets(ticketRepository)
	if err != nil {
		return nil, err
	}
	ticketHandler, err := tickethttp.NewHandler(readTickets, authHandler.RequireSession())
	if err != nil {
		return nil, err
	}
	gateTransaction, err := bookingpostgres.NewUnitOfWork(pool)
	if err != nil {
		return nil, err
	}
	gateTickets, err := ticketapp.NewGateTickets(ticketRepository, gateTransaction, platformclock.SystemClock{})
	if err != nil {
		return nil, err
	}
	gateHandler, err := tickethttp.NewGateHandler(gateTickets, authHandler.RequireSession())
	if err != nil {
		return nil, err
	}
	passengerHandler, err := NewPassengerHandler(pool, authHandler.RequireSession())
	if err != nil {
		return nil, err
	}
	paymentHandler, err := NewPaymentHandler(cfg, pool, bookingModule, authHandler.RequireSession())
	if err != nil {
		return nil, err
	}

	router := transporthttp.NewRouter(logger, searchTripsHandler, listSeatsHandler, authHandler, bookingHandler, bookingReadHandler, passengerHandler, paymentHandler, ticketHandler, gateHandler, adminHandler)
	if err := router.SetTrustedProxies(cfg.HTTPTrustedProxies); err != nil {
		return nil, err
	}
	router.GET("/readyz", func(c *gin.Context) {
		pingCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(pingCtx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not_ready"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return &http.Server{
		Addr:              cfg.HTTPAddress,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}, nil
}
