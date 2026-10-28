package http

import (
	"context"
	"errors"
	"net/http"
	"time"

	ticketapp "example.com/train-ticket/internal/ticket/application"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type ReadTicketsUseCase interface {
	List(ctx context.Context, bookingID, customerID string) ([]ticketapp.TicketView, error)
}

type Handler struct {
	read           ReadTicketsUseCase
	requireSession gin.HandlerFunc
}

func NewHandler(read ReadTicketsUseCase, requireSession gin.HandlerFunc) (*Handler, error) {
	if read == nil || requireSession == nil {
		return nil, errors.New("ticket routes require a read use case and session middleware")
	}
	return &Handler{read: read, requireSession: requireSession}, nil
}

func (h *Handler) RegisterRoutes(routes *gin.RouterGroup) {
	protected := routes.Group("/bookings", transporthttp.NoStore(), h.requireSession)
	protected.GET("/:id/tickets", transporthttp.Wrap(h.list))
}

type ticketResponse struct {
	ID          string    `json:"id"`
	BookingID   string    `json:"booking_id"`
	SeatID      string    `json:"seat_id"`
	IssuedAt    time.Time `json:"issued_at"`
	FullName    string    `json:"full_name"`
	CoachNumber string    `json:"coach_number"`
	SeatNumber  string    `json:"seat_number"`
}

func (h *Handler) list(c *gin.Context) (transporthttp.Result, error) {
	tickets, err := h.read.List(c.Request.Context(), c.Param("id"), transporthttp.UserID(c.Request.Context()))
	if err != nil {
		switch {
		case errors.Is(err, ticketapp.ErrTicketBookingNotFound):
			return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusNotFound, Code: "booking_not_found", Message: "booking was not found", Cause: err}
		case errors.Is(err, ticketapp.ErrTicketsUnavailable):
			return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusConflict, Code: "tickets_unavailable", Message: "tickets are available after booking confirmation", Cause: err}
		default:
			return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusInternalServerError, Code: "ticket_read_error", Message: "could not load tickets", Cause: err}
		}
	}
	items := make([]ticketResponse, 0, len(tickets))
	for _, ticket := range tickets {
		items = append(items, ticketResponse{
			ID: ticket.ID, BookingID: ticket.BookingID, SeatID: ticket.SeatID,
			IssuedAt: ticket.IssuedAt, FullName: ticket.FullName,
			CoachNumber: ticket.CoachNumber, SeatNumber: ticket.SeatNumber,
		})
	}
	return transporthttp.Result{Status: http.StatusOK, Body: gin.H{"tickets": items}}, nil
}
