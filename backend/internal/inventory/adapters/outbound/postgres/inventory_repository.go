package postgres

import (
	"context"
	"errors"
	"fmt"

	"example.com/train-ticket/internal/inventory/adapters/outbound/postgres/sqlcgen"
	inventoryapp "example.com/train-ticket/internal/inventory/application"
	"example.com/train-ticket/internal/inventory/domain"
	platformpostgres "example.com/train-ticket/internal/platform/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type InventoryRepository struct {
	pool *pgxpool.Pool
}

var _ inventoryapp.InventoryRepository = (*InventoryRepository)(nil)

func NewInventoryRepository(pool *pgxpool.Pool) (*InventoryRepository, error) {
	if pool == nil {
		return nil, errors.New("postgres connection pool is required")
	}
	return &InventoryRepository{pool: pool}, nil
}

func (r *InventoryRepository) LoadForUpdate(
	ctx context.Context,
	tripID, seatID string,
) (domain.SeatInventory, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return domain.SeatInventory{}, err
	}
	queries := sqlcgen.New(platformpostgres.Executor(ctx, r.pool))
	seat, err := queries.LockTripSeat(ctx, sqlcgen.LockTripSeatParams{
		TripID: tripID,
		SeatID: seatID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SeatInventory{}, domain.ErrSeatNotFound
	}
	if err != nil {
		return domain.SeatInventory{}, fmt.Errorf("lock trip seat: %w", err)
	}
	return r.loadInventory(ctx, queries, seat.TripID, seat.SeatID, int(seat.StopCount))
}

func (r *InventoryRepository) ListBookingSeatIDs(ctx context.Context, bookingID string) ([]string, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return nil, err
	}
	seatIDs, err := sqlcgen.New(platformpostgres.Executor(ctx, r.pool)).ListBookingSeatIDs(ctx, bookingID)
	if err != nil {
		return nil, fmt.Errorf("list seats for booking %q: %w", bookingID, err)
	}
	if len(seatIDs) == 0 {
		return nil, domain.ErrReservationNotFound
	}
	return seatIDs, nil
}

func (r *InventoryRepository) LoadForBookingSeatUpdate(ctx context.Context, bookingID, seatID string) (domain.SeatInventory, error) {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return domain.SeatInventory{}, err
	}
	queries := sqlcgen.New(platformpostgres.Executor(ctx, r.pool))
	seat, err := queries.LockBookingSeat(ctx, sqlcgen.LockBookingSeatParams{BookingID: bookingID, SeatID: seatID})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SeatInventory{}, domain.ErrReservationNotFound
	}
	if err != nil {
		return domain.SeatInventory{}, fmt.Errorf("lock booking seat: %w", err)
	}
	return r.loadInventory(ctx, queries, seat.TripID, seat.SeatID, int(seat.StopCount))
}

func (r *InventoryRepository) loadInventory(
	ctx context.Context,
	queries *sqlcgen.Queries,
	tripID, seatID string,
	stopCount int,
) (domain.SeatInventory, error) {
	rows, err := queries.ListSeatReservations(ctx, sqlcgen.ListSeatReservationsParams{
		TripID: tripID,
		SeatID: seatID,
	})
	if err != nil {
		return domain.SeatInventory{}, fmt.Errorf("load seat reservations: %w", err)
	}

	snapshots := make([]domain.ReservationSnapshot, 0, len(rows))
	for _, row := range rows {
		segment, err := domain.NewSegment(int(row.FromStop), int(row.ToStop))
		if err != nil {
			return domain.SeatInventory{}, fmt.Errorf("invalid stored segment for booking %q: %w", row.BookingID, err)
		}
		status, err := reservationStatus(row.Status)
		if err != nil {
			return domain.SeatInventory{}, fmt.Errorf("invalid stored reservation status for booking %q: %w", row.BookingID, err)
		}
		if !row.ExpiresAt.Valid {
			return domain.SeatInventory{}, fmt.Errorf("reservation for booking %q has no expiration", row.BookingID)
		}
		snapshots = append(snapshots, domain.ReservationSnapshot{
			BookingID: row.BookingID,
			Segment:   segment,
			Status:    status,
			ExpiresAt: row.ExpiresAt.Time,
		})
	}

	inventory, err := domain.RestoreSeatInventory(
		tripID,
		seatID,
		stopCount,
		snapshots,
	)
	if err != nil {
		return domain.SeatInventory{}, fmt.Errorf("restore seat inventory: %w", err)
	}
	return inventory, nil
}

func (r *InventoryRepository) Save(ctx context.Context, inventory domain.SeatInventory) error {
	if err := platformpostgres.RequireTransaction(ctx); err != nil {
		return err
	}
	queries := sqlcgen.New(platformpostgres.Executor(ctx, r.pool))
	for _, snapshot := range inventory.Reservations() {
		status, err := reservationStatusName(snapshot.Status)
		if err != nil {
			return err
		}
		if err := queries.UpsertSeatReservation(ctx, sqlcgen.UpsertSeatReservationParams{
			BookingID: snapshot.BookingID,
			TripID:    inventory.TripID(),
			SeatID:    inventory.SeatID(),
			FromStop:  int16(snapshot.Segment.From()),
			ToStop:    int16(snapshot.Segment.To()),
			Status:    status,
			ExpiresAt: pgtype.Timestamptz{Time: snapshot.ExpiresAt, Valid: true},
		}); err != nil {
			return fmt.Errorf("save reservation for booking %q: %w", snapshot.BookingID, err)
		}
	}
	return nil
}

func reservationStatus(value string) (domain.ReservationStatus, error) {
	switch value {
	case "held":
		return domain.ReservationHeld, nil
	case "confirmed":
		return domain.ReservationConfirmed, nil
	case "released":
		return domain.ReservationReleased, nil
	default:
		return 0, fmt.Errorf("unknown status %q", value)
	}
}

func reservationStatusName(value domain.ReservationStatus) (string, error) {
	switch value {
	case domain.ReservationHeld:
		return "held", nil
	case domain.ReservationConfirmed:
		return "confirmed", nil
	case domain.ReservationReleased:
		return "released", nil
	default:
		return "", fmt.Errorf("unknown reservation status %d", value)
	}
}
