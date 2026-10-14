package app

import (
	authhttp "example.com/train-ticket/internal/auth/adapters/inbound/http"
	authpostgres "example.com/train-ticket/internal/auth/adapters/outbound/postgres"
	"example.com/train-ticket/internal/auth/adapters/outbound/security"
	authapp "example.com/train-ticket/internal/auth/application"
	platformclock "example.com/train-ticket/internal/platform/clock"
	platformid "example.com/train-ticket/internal/platform/id"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewAuthHandler(pool *pgxpool.Pool) (*authhttp.Handler, error) {
	repository, err := authpostgres.NewRepository(pool)
	if err != nil {
		return nil, err
	}
	service, err := authapp.NewService(repository, security.BcryptHasher{}, security.RandomTokenGenerator{}, platformid.UUIDGenerator{}, platformclock.SystemClock{})
	if err != nil {
		return nil, err
	}
	return authhttp.NewHandler(service), nil
}
