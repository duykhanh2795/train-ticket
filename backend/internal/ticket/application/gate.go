package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"example.com/train-ticket/internal/ticket/domain"
)

var (
	ErrInvalidGateCode  = errors.New("invalid gate QR code")
	ErrGateForbidden    = errors.New("gate access is required")
	ErrGateTicketAbsent = errors.New("gate ticket not found")
	ErrGateNotReady     = errors.New("ticket is not ready for boarding")
	ErrGateAlreadyUsed  = errors.New("ticket was already used")
)

const gateQRPrefix = "railway:ticket:v1:"

type GateTicket struct {
	ID                string
	BookingID         string
	FullName          string
	TrainNumber       string
	CoachNumber       string
	SeatNumber        string
	BoardingStationID string
	DepartureAt       time.Time
	BookingStatus     string
	TripStatus        string
	ScannedAt         *time.Time
	Decision          domain.GateDecision
}

type GateRepository interface {
	StationForAgent(context.Context, string) (string, error)
	FindForGate(context.Context, string) (GateTicket, error)
	LockForGate(context.Context, string) (GateTicket, error)
	RecordScan(context.Context, string, string, string, time.Time) (bool, error)
}

type GateUnitOfWork interface {
	WithinTransaction(context.Context, func(context.Context) error) error
}

type GateTickets struct {
	repository GateRepository
	tx         GateUnitOfWork
	clock      Clock
}

func NewGateTickets(repository GateRepository, tx GateUnitOfWork, clock Clock) (*GateTickets, error) {
	if repository == nil || tx == nil || clock == nil {
		return nil, errors.New("gate ticket dependencies are required")
	}
	return &GateTickets{repository: repository, tx: tx, clock: clock}, nil
}

func (uc *GateTickets) Inspect(ctx context.Context, agentID, qrCode string) (GateTicket, error) {
	ticketID, err := parseGateQR(qrCode)
	if err != nil {
		return GateTicket{}, err
	}
	stationID, err := uc.repository.StationForAgent(ctx, agentID)
	if err != nil {
		return GateTicket{}, fmt.Errorf("authorize gate agent: %w", err)
	}
	ticket, err := uc.repository.FindForGate(ctx, ticketID)
	if err != nil {
		return GateTicket{}, fmt.Errorf("find gate ticket: %w", err)
	}
	if ticket.BoardingStationID != stationID {
		return GateTicket{}, ErrGateTicketAbsent
	}
	ticket.Decision = domain.AssessBoarding(ticket.BookingStatus, ticket.TripStatus, ticket.DepartureAt, uc.clock.Now().UTC(), ticket.ScannedAt)
	return ticket, nil
}

func (uc *GateTickets) Admit(ctx context.Context, agentID, qrCode string) (GateTicket, error) {
	ticketID, err := parseGateQR(qrCode)
	if err != nil {
		return GateTicket{}, err
	}
	var admitted GateTicket
	err = uc.tx.WithinTransaction(ctx, func(txCtx context.Context) error {
		stationID, err := uc.repository.StationForAgent(txCtx, agentID)
		if err != nil {
			return fmt.Errorf("authorize gate agent: %w", err)
		}
		ticket, err := uc.repository.LockForGate(txCtx, ticketID)
		if err != nil {
			return fmt.Errorf("lock gate ticket: %w", err)
		}
		if ticket.BoardingStationID != stationID {
			return ErrGateTicketAbsent
		}
		now := uc.clock.Now().UTC()
		ticket.Decision = domain.AssessBoarding(ticket.BookingStatus, ticket.TripStatus, ticket.DepartureAt, now, ticket.ScannedAt)
		if ticket.Decision == domain.GateAlreadyUsed {
			return ErrGateAlreadyUsed
		}
		if ticket.Decision != domain.GateReady {
			return ErrGateNotReady
		}
		created, err := uc.repository.RecordScan(txCtx, ticketID, agentID, stationID, now)
		if err != nil {
			return fmt.Errorf("record gate scan: %w", err)
		}
		if !created {
			return ErrGateAlreadyUsed
		}
		ticket.Decision = domain.GateAdmitted
		ticket.ScannedAt = &now
		admitted = ticket
		return nil
	})
	if err != nil {
		return GateTicket{}, err
	}
	return admitted, nil
}

func parseGateQR(qrCode string) (string, error) {
	if len(qrCode) != len(gateQRPrefix)+36 || !strings.HasPrefix(qrCode, gateQRPrefix) {
		return "", ErrInvalidGateCode
	}
	id := strings.TrimPrefix(qrCode, gateQRPrefix)
	for index, char := range id {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			if char != '-' {
				return "", ErrInvalidGateCode
			}
			continue
		}
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f')) {
			return "", ErrInvalidGateCode
		}
	}
	return id, nil
}
