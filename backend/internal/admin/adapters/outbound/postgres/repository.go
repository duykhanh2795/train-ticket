package postgres

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"example.com/train-ticket/internal/admin/adapters/outbound/postgres/sqlcgen"
	"example.com/train-ticket/internal/admin/application"
	"example.com/train-ticket/internal/admin/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) (*Repository, error) {
	if pool == nil {
		return nil, errors.New("postgres pool is required")
	}
	return &Repository{pool: pool}, nil
}

func (r *Repository) IsAdmin(ctx context.Context, userID string) (bool, error) {
	ok, err := sqlcgen.New(r.pool).IsAdmin(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("check admin permission: %w", err)
	}
	return ok, nil
}

func (r *Repository) ListStations(ctx context.Context) ([]application.StationView, error) {
	rows, err := sqlcgen.New(r.pool).ListStations(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stations: %w", err)
	}
	result := make([]application.StationView, 0, len(rows))
	for _, row := range rows {
		result = append(result, application.StationView{ID: row.ID, Code: row.Code, Name: row.Name, City: row.City})
	}
	return result, nil
}

func (r *Repository) CreateStation(ctx context.Context, station domain.Station) error {
	err := sqlcgen.New(r.pool).InsertStation(ctx, sqlcgen.InsertStationParams{ID: station.Code, Code: station.Code, Name: station.Name, City: station.City})
	return catalogError("create station", err)
}

func (r *Repository) ListTrips(ctx context.Context, limit, offset int32) ([]application.TripView, error) {
	rows, err := sqlcgen.New(r.pool).ListAdminTrips(ctx, sqlcgen.ListAdminTripsParams{Limit: limit, Offset: offset})
	if err != nil {
		return nil, fmt.Errorf("list trips: %w", err)
	}
	result := make([]application.TripView, 0, len(rows))
	for _, row := range rows {
		result = append(result, application.TripView{ID: row.ID, TrainNumber: row.TrainNumber, ServiceDate: row.ServiceDate.Time.Format("2006-01-02"), Status: row.Status, StopCount: row.StopCount, SeatCount: row.SeatCount})
	}
	return result, nil
}

func (r *Repository) CreateTrip(ctx context.Context, trip domain.Trip) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin trip transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	q := sqlcgen.New(tx)
	if err := q.InsertAdminTrip(ctx, sqlcgen.InsertAdminTripParams{ID: trip.ID, TrainNumber: trip.TrainNumber, ServiceDate: pgtype.Date{Time: trip.ServiceDate, Valid: true}}); err != nil {
		return catalogError("insert trip", err)
	}
	for i, stop := range trip.Stops {
		if err := q.InsertAdminTripStop(ctx, sqlcgen.InsertAdminTripStopParams{TripID: trip.ID, StationID: stop.StationID, StopOrder: int16(i), ArrivalAt: timestamp(stop.ArrivalAt), DepartureAt: timestamp(stop.DepartureAt)}); err != nil {
			return catalogError("insert trip stop", err)
		}
	}
	for _, group := range trip.SeatGroups {
		for i := 1; i <= group.SeatCount; i++ {
			seatNumber := strconv.Itoa(i)
			seatID := group.CoachNumber + "-" + seatNumber
			if err := q.InsertAdminTripSeat(ctx, sqlcgen.InsertAdminTripSeatParams{TripID: trip.ID, SeatID: seatID, CoachNumber: group.CoachNumber, SeatNumber: seatNumber, SeatType: group.SeatType}); err != nil {
				return catalogError("insert trip seat", err)
			}
		}
	}
	for _, fare := range trip.Fares {
		if err := q.InsertAdminTripFare(ctx, sqlcgen.InsertAdminTripFareParams{TripID: trip.ID, FromStop: int16(fare.FromStop), SeatType: fare.SeatType, AmountVnd: fare.AmountVND}); err != nil {
			return catalogError("insert trip fare", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit trip: %w", err)
	}
	return nil
}

func (r *Repository) ListBookings(ctx context.Context, limit, offset int32) ([]application.BookingView, error) {
	rows, err := sqlcgen.New(r.pool).ListAdminBookings(ctx, sqlcgen.ListAdminBookingsParams{Limit: limit, Offset: offset})
	if err != nil {
		return nil, fmt.Errorf("list admin bookings: %w", err)
	}
	result := make([]application.BookingView, 0, len(rows))
	for _, row := range rows {
		v := application.BookingView{ID: row.ID, TripID: row.TripID, TrainNumber: row.TrainNumber, ServiceDate: row.ServiceDate.Time.Format("2006-01-02"), Status: row.Status, CreatedAt: row.CreatedAt.Time}
		if row.CustomerEmail.Valid {
			v.CustomerEmail = row.CustomerEmail.String
		}
		if row.FareVnd.Valid {
			amount := row.FareVnd.Int64
			v.FareVND = &amount
		}
		result = append(result, v)
	}
	return result, nil
}

func timestamp(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: t.UTC(), Valid: true}
}

func catalogError(operation string, err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return fmt.Errorf("%s: %w", operation, domain.ErrConflict)
		case "23503", "23514", "22003":
			return fmt.Errorf("%s: %w", operation, domain.ErrInvalidCatalog)
		}
	}
	return fmt.Errorf("%s: %w", operation, err)
}
