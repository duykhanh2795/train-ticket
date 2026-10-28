package http

import (
	"context"
	"errors"
	"net/http"
	"time"

	ticketapp "example.com/train-ticket/internal/ticket/application"
	"example.com/train-ticket/internal/ticket/domain"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type GateUseCase interface {
	Inspect(context.Context, string, string) (ticketapp.GateTicket, error)
	Admit(context.Context, string, string) (ticketapp.GateTicket, error)
}

type GateHandler struct {
	gate           GateUseCase
	requireSession gin.HandlerFunc
}

func NewGateHandler(gate GateUseCase, requireSession gin.HandlerFunc) (*GateHandler, error) {
	if gate == nil || requireSession == nil {
		return nil, errors.New("gate routes require a use case and session middleware")
	}
	return &GateHandler{gate: gate, requireSession: requireSession}, nil
}

func (h *GateHandler) RegisterRoutes(routes *gin.RouterGroup) {
	protected := routes.Group("/gate/tickets", transporthttp.NoStore(), h.requireSession)
	protected.POST("/inspect", transporthttp.Wrap(h.inspect))
	protected.POST("/admit", transporthttp.Wrap(h.admit))
}

type gateRequest struct {
	QRCode string `json:"qr_code" binding:"required,max=128"`
}

type gateResponse struct {
	TicketID          string              `json:"ticket_id"`
	BookingID         string              `json:"booking_id"`
	FullName          string              `json:"full_name"`
	TrainNumber       string              `json:"train_number"`
	CoachNumber       string              `json:"coach_number"`
	SeatNumber        string              `json:"seat_number"`
	BoardingStationID string              `json:"boarding_station_id"`
	DepartureAt       time.Time           `json:"departure_at"`
	Decision          domain.GateDecision `json:"decision"`
	ScannedAt         *time.Time          `json:"scanned_at,omitempty"`
}

func (h *GateHandler) inspect(c *gin.Context) (transporthttp.Result, error) {
	var request gateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	ticket, err := h.gate.Inspect(c.Request.Context(), transporthttp.UserID(c.Request.Context()), request.QRCode)
	if err != nil {
		return transporthttp.Result{}, mapGateError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: gateTicketResponse(ticket)}, nil
}

func (h *GateHandler) admit(c *gin.Context) (transporthttp.Result, error) {
	var request gateRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	ticket, err := h.gate.Admit(c.Request.Context(), transporthttp.UserID(c.Request.Context()), request.QRCode)
	if err != nil {
		return transporthttp.Result{}, mapGateError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: gateTicketResponse(ticket)}, nil
}

func gateTicketResponse(ticket ticketapp.GateTicket) gateResponse {
	return gateResponse{
		TicketID: ticket.ID, BookingID: ticket.BookingID, FullName: ticket.FullName,
		TrainNumber: ticket.TrainNumber, CoachNumber: ticket.CoachNumber,
		SeatNumber: ticket.SeatNumber, BoardingStationID: ticket.BoardingStationID,
		DepartureAt: ticket.DepartureAt, Decision: ticket.Decision, ScannedAt: ticket.ScannedAt,
	}
}

func mapGateError(err error) error {
	switch {
	case errors.Is(err, ticketapp.ErrInvalidGateCode):
		return &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_gate_code", Message: "scan a valid ticket QR code", Cause: err}
	case errors.Is(err, ticketapp.ErrGateForbidden):
		return &transporthttp.APIError{Status: http.StatusForbidden, Code: "gate_forbidden", Message: "gate access is required", Cause: err}
	case errors.Is(err, ticketapp.ErrGateTicketAbsent):
		return &transporthttp.APIError{Status: http.StatusNotFound, Code: "gate_ticket_not_found", Message: "ticket was not found for this station", Cause: err}
	case errors.Is(err, ticketapp.ErrGateAlreadyUsed):
		return &transporthttp.APIError{Status: http.StatusConflict, Code: "ticket_already_used", Message: "ticket was already used at the gate", Cause: err}
	case errors.Is(err, ticketapp.ErrGateNotReady):
		return &transporthttp.APIError{Status: http.StatusConflict, Code: "ticket_not_boardable", Message: "ticket is not ready for boarding", Cause: err}
	default:
		return &transporthttp.APIError{Status: http.StatusInternalServerError, Code: "gate_error", Message: "could not process ticket at the gate", Cause: err}
	}
}
