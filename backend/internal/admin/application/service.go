package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"example.com/train-ticket/internal/admin/domain"
)

type IDGenerator interface{ NewID() (string, error) }
type Clock interface{ Now() time.Time }

type Repository interface {
	IsAdmin(context.Context, string) (bool, error)
	ListStations(context.Context) ([]StationView, error)
	CreateStation(context.Context, domain.Station) error
	ListTrips(context.Context, int32, int32) ([]TripView, error)
	CreateTrip(context.Context, domain.Trip) error
	ListBookings(context.Context, int32, int32) ([]BookingView, error)
}

type StationView struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
	City string `json:"city"`
}

type TripView struct {
	ID          string `json:"id"`
	TrainNumber string `json:"train_number"`
	ServiceDate string `json:"service_date"`
	Status      string `json:"status"`
	StopCount   int64  `json:"stop_count"`
	SeatCount   int64  `json:"seat_count"`
}

type BookingView struct {
	ID            string    `json:"id"`
	TripID        string    `json:"trip_id"`
	TrainNumber   string    `json:"train_number"`
	ServiceDate   string    `json:"service_date"`
	CustomerEmail string    `json:"customer_email"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	FareVND       *int64    `json:"fare_vnd"`
}

type Service struct {
	repo  Repository
	ids   IDGenerator
	clock Clock
}

func NewService(repo Repository, ids IDGenerator, clock Clock) (*Service, error) {
	if repo == nil || ids == nil || clock == nil {
		return nil, errors.New("admin dependencies are required")
	}
	return &Service{repo: repo, ids: ids, clock: clock}, nil
}

func (s *Service) IsAdmin(ctx context.Context, userID string) (bool, error) {
	return s.repo.IsAdmin(ctx, userID)
}

func (s *Service) ListStations(ctx context.Context) ([]StationView, error) {
	return s.repo.ListStations(ctx)
}

func (s *Service) CreateStation(ctx context.Context, station domain.Station) error {
	if err := station.Validate(); err != nil {
		return err
	}
	return s.repo.CreateStation(ctx, station)
}

func (s *Service) ListTrips(ctx context.Context, limit, offset int32) ([]TripView, error) {
	return s.repo.ListTrips(ctx, limit, offset)
}

func (s *Service) CreateTrip(ctx context.Context, trip domain.Trip) (string, error) {
	if err := trip.Validate(s.clock.Now()); err != nil {
		return "", err
	}
	id, err := s.ids.NewID()
	if err != nil {
		return "", fmt.Errorf("generate trip ID: %w", err)
	}
	trip.ID = id
	if err := s.repo.CreateTrip(ctx, trip); err != nil {
		return "", err
	}
	return id, nil
}

func (s *Service) ListBookings(ctx context.Context, limit, offset int32) ([]BookingView, error) {
	return s.repo.ListBookings(ctx, limit, offset)
}
