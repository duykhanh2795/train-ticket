package postgres

import (
	"context"
	"errors"
	"fmt"

	"example.com/train-ticket/internal/booking/adapters/outbound/postgres/sqlcgen"
	bookingapp "example.com/train-ticket/internal/booking/application"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BookingReadRepository struct {
	pool *pgxpool.Pool
}

var _ bookingapp.BookingReadRepository = (*BookingReadRepository)(nil)

func NewBookingReadRepository(pool *pgxpool.Pool) (*BookingReadRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &BookingReadRepository{pool: pool}, nil
}

func (r *BookingReadRepository) ListByCustomer(ctx context.Context, customerID string, limit, offset int) ([]bookingapp.BookingView, error) {
	rows, err := sqlcgen.New(r.pool).ListCustomerBookings(ctx, sqlcgen.ListCustomerBookingsParams{
		CustomerID: customerID,
		PageSize:   int32(limit),
		PageOffset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("query customer bookings: %w", err)
	}
	items := make([]bookingapp.BookingView, 0, len(rows))
	for _, row := range rows {
		if !row.CreatedAt.Valid || !row.ExpiresAt.Valid {
			return nil, fmt.Errorf("booking %q has incomplete timestamps", row.BookingID)
		}
		items = append(items, bookingapp.BookingView{
			BookingID: row.BookingID, TripID: row.TripID, Status: row.Status,
			CreatedAt: row.CreatedAt.Time, ExpiresAt: row.ExpiresAt.Time,
			FareVND:     farePointer(row.FareVnd.Int64, row.FareVnd.Valid),
			TrainNumber: row.TrainNumber, ServiceDate: row.ServiceDate,
			CoachNumber: row.CoachNumber, SeatNumber: row.SeatNumber, SeatType: row.SeatType,
			FromStop: int(row.FromStop), ToStop: int(row.ToStop),
			OriginStation: row.OriginStation, DestinationStation: row.DestinationStation,
		})
	}
	if err := r.attachSeats(ctx, items); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *BookingReadRepository) FindByCustomer(ctx context.Context, customerID, bookingID string) (bookingapp.BookingView, error) {
	row, err := sqlcgen.New(r.pool).GetCustomerBooking(ctx, sqlcgen.GetCustomerBookingParams{
		CustomerID: customerID, BookingID: bookingID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return bookingapp.BookingView{}, bookingapp.ErrBookingNotFound
	}
	if err != nil {
		return bookingapp.BookingView{}, fmt.Errorf("query booking %q: %w", bookingID, err)
	}
	if !row.CreatedAt.Valid || !row.ExpiresAt.Valid {
		return bookingapp.BookingView{}, fmt.Errorf("booking %q has incomplete timestamps", bookingID)
	}
	view := bookingapp.BookingView{
		BookingID: row.BookingID, TripID: row.TripID, Status: row.Status,
		CreatedAt: row.CreatedAt.Time, ExpiresAt: row.ExpiresAt.Time,
		FareVND:     farePointer(row.FareVnd.Int64, row.FareVnd.Valid),
		TrainNumber: row.TrainNumber, ServiceDate: row.ServiceDate,
		CoachNumber: row.CoachNumber, SeatNumber: row.SeatNumber, SeatType: row.SeatType,
		FromStop: int(row.FromStop), ToStop: int(row.ToStop),
		OriginStation: row.OriginStation, DestinationStation: row.DestinationStation,
	}
	items := []bookingapp.BookingView{view}
	if err := r.attachSeats(ctx, items); err != nil {
		return bookingapp.BookingView{}, err
	}
	return items[0], nil
}

func (r *BookingReadRepository) attachSeats(ctx context.Context, items []bookingapp.BookingView) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]string, len(items))
	positions := make(map[string]int, len(items))
	for index, item := range items {
		ids[index] = item.BookingID
		positions[item.BookingID] = index
	}
	rows, err := sqlcgen.New(r.pool).ListBookingSeats(ctx, ids)
	if err != nil {
		return fmt.Errorf("list booking seats: %w", err)
	}
	for _, row := range rows {
		index, ok := positions[row.BookingID]
		if !ok {
			continue
		}
		items[index].Seats = append(items[index].Seats, bookingapp.BookingSeatView{
			SeatID: row.SeatID, CoachNumber: row.CoachNumber,
			SeatNumber: row.SeatNumber, SeatType: row.SeatType, FullName: row.FullName,
		})
	}
	return nil
}

func farePointer(amount int64, valid bool) *int64 {
	if !valid {
		return nil
	}
	return &amount
}
