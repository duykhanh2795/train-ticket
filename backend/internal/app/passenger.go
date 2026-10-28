package app

import (
	passengerhttp "example.com/train-ticket/internal/passenger/adapters/inbound/http"
	passengerpostgres "example.com/train-ticket/internal/passenger/adapters/outbound/postgres"
	passengerapp "example.com/train-ticket/internal/passenger/application"
	platformclock "example.com/train-ticket/internal/platform/clock"
	platformid "example.com/train-ticket/internal/platform/id"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPassengerHandler(pool *pgxpool.Pool, requireSession gin.HandlerFunc) (*passengerhttp.Handler, error) {
	repository, err := passengerpostgres.NewSavedPassengerRepository(pool)
	if err != nil {
		return nil, err
	}
	service, err := passengerapp.NewService(repository, platformid.UUIDGenerator{}, platformclock.SystemClock{})
	if err != nil {
		return nil, err
	}
	return passengerhttp.NewHandler(service, requireSession), nil
}
