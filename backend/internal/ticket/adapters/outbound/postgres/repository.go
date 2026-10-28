package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"example.com/train-ticket/internal/ticket/adapters/outbound/postgres/sqlcgen"
	ticketapp "example.com/train-ticket/internal/ticket/application"
	"example.com/train-ticket/internal/ticket/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TicketRepository struct{ pool *pgxpool.Pool }

var _ ticketapp.TicketRepository = (*TicketRepository)(nil)
var _ ticketapp.TicketReadRepository = (*TicketRepository)(nil)
var _ ticketapp.GateRepository = (*TicketRepository)(nil)

func NewTicketRepository(pool *pgxpool.Pool) (*TicketRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &TicketRepository{pool: pool}, nil
}

func (r *TicketRepository) HasTicketPassengers(ctx context.Context, bookingID string) (bool, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return false, err
	}
	ready, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).HasTicketPassengers(ctx, bookingID)
	if err != nil {
		return false, fmt.Errorf("check ticket passengers for booking %q: %w", bookingID, err)
	}
	if !ready.Valid {
		return false, fmt.Errorf("ticket passenger readiness for booking %q is null", bookingID)
	}
	return ready.Bool, nil
}

func (r *TicketRepository) ListSeatIDs(ctx context.Context, bookingID string) ([]string, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return nil, err
	}
	seatIDs, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).ListTicketSeatIDs(ctx, bookingID)
	if err != nil {
		return nil, fmt.Errorf("list seats for booking %q: %w", bookingID, err)
	}
	return seatIDs, nil
}

func (r *TicketRepository) Create(ctx context.Context, ticket domain.Ticket) (bool, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return false, err
	}

	queries := sqlcgen.New(platformpostgres.Executor(ctx, r.pool))
	rowsAffected, err := queries.CreateTicket(ctx, sqlcgen.CreateTicketParams{
		ID:        ticket.ID(),
		IssuedAt:  pgtype.Timestamptz{Time: ticket.IssuedAt(), Valid: true},
		BookingID: ticket.BookingID(),
		SeatID:    ticket.SeatID(),
	})
	if err != nil {
		return false, fmt.Errorf("create ticket %q: %w", ticket.ID(), err)
	}
	return rowsAffected == 1, nil
}

func (r *TicketRepository) ListByBooking(ctx context.Context, bookingID, customerID string) ([]ticketapp.TicketView, error) {
	rows, err := sqlcgen.New(r.pool).ListTicketsByBooking(
		ctx, sqlcgen.ListTicketsByBookingParams{
			BookingID:  bookingID,
			CustomerID: customerID,
		})
	if err != nil {
		return nil, fmt.Errorf("list tickets for booking %q: %w", bookingID, err)
	}
	result := make([]ticketapp.TicketView, 0, len(rows))
	for _, row := range rows {
		ticket, err := mapTicket(row)
		if err != nil {
			return nil, err
		}
		result = append(result, ticket)
	}
	return result, nil
}

func (r *TicketRepository) BookingStatus(ctx context.Context, bookingID, customerID string) (string, error) {
	status, err := sqlcgen.New(r.pool).GetTicketBookingStatus(ctx, sqlcgen.GetTicketBookingStatusParams{
		BookingID: bookingID, CustomerID: customerID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ticketapp.ErrTicketBookingNotFound
	}
	if err != nil {
		return "", fmt.Errorf("get ticket booking status %q: %w", bookingID, err)
	}
	return status, nil
}

func mapTicket(row sqlcgen.ListTicketsByBookingRow) (ticketapp.TicketView, error) {
	if !row.IssuedAt.Valid {
		return ticketapp.TicketView{}, fmt.Errorf("ticket %q has no issued time", row.ID)
	}
	ticket, err := domain.NewTicket(row.ID, row.BookingID, row.SeatID, row.IssuedAt.Time)
	if err != nil {
		return ticketapp.TicketView{}, fmt.Errorf("ticket %q: %w", row.ID, err)
	}
	return ticketapp.TicketView{
		ID:          ticket.ID(),
		BookingID:   ticket.BookingID(),
		SeatID:      ticket.SeatID(),
		IssuedAt:    ticket.IssuedAt(),
		FullName:    row.FullName,
		CoachNumber: row.CoachNumber,
		SeatNumber:  row.SeatNumber,
	}, nil
}

func (r *TicketRepository) StationForAgent(ctx context.Context, agentID string) (string, error) {
	stationID, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).GetGateAgentStation(ctx, agentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ticketapp.ErrGateForbidden
	}
	if err != nil {
		return "", fmt.Errorf("find gate assignment for agent %q: %w", agentID, err)
	}
	return stationID, nil
}

func (r *TicketRepository) FindForGate(ctx context.Context, ticketID string) (ticketapp.GateTicket, error) {
	row, err := sqlcgen.New(r.pool).GetGateTicket(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ticketapp.GateTicket{}, ticketapp.ErrGateTicketAbsent
	}
	if err != nil {
		return ticketapp.GateTicket{}, fmt.Errorf("find gate ticket %q: %w", ticketID, err)
	}
	return mapGateTicket(row), nil
}

func (r *TicketRepository) LockForGate(ctx context.Context, ticketID string) (ticketapp.GateTicket, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return ticketapp.GateTicket{}, err
	}
	row, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).LockGateTicket(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ticketapp.GateTicket{}, ticketapp.ErrGateTicketAbsent
	}
	if err != nil {
		return ticketapp.GateTicket{}, fmt.Errorf("lock gate ticket %q: %w", ticketID, err)
	}
	return mapGateTicket(sqlcgen.GetGateTicketRow(row)), nil
}

func (r *TicketRepository) RecordScan(ctx context.Context, ticketID, agentID, stationID string, at time.Time) (bool, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return false, err
	}
	rows, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).RecordGateScan(ctx, sqlcgen.RecordGateScanParams{
		TicketID: ticketID, GateAgentID: agentID, StationID: stationID,
		ScannedAt: pgtype.Timestamptz{Time: at.UTC(), Valid: true},
	})
	if err != nil {
		return false, fmt.Errorf("record gate scan for ticket %q: %w", ticketID, err)
	}
	return rows == 1, nil
}

func mapGateTicket(row sqlcgen.GetGateTicketRow) ticketapp.GateTicket {
	view := ticketapp.GateTicket{
		ID: row.ID, BookingID: row.BookingID, FullName: row.FullName,
		TrainNumber: row.TrainNumber, CoachNumber: row.CoachNumber,
		SeatNumber: row.SeatNumber, BoardingStationID: row.BoardingStationID,
		BookingStatus: row.BookingStatus, TripStatus: row.TripStatus,
	}
	if row.DepartureAt.Valid {
		view.DepartureAt = row.DepartureAt.Time.UTC()
	}
	if row.ScannedAt.Valid {
		scannedAt := row.ScannedAt.Time.UTC()
		view.ScannedAt = &scannedAt
	}
	return view
}
