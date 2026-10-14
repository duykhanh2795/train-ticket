package http

import (
	"context"
	"errors"
	"net/http"

	bookingapp "example.com/train-ticket/internal/booking/application"
	bookingdomain "example.com/train-ticket/internal/booking/domain"
	inventorydomain "example.com/train-ticket/internal/inventory/domain"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type HoldBookingUseCase interface {
	Execute(ctx context.Context, command bookingapp.HoldBookingCommand) (bookingdomain.Booking, error)
}

type ConfirmBookingUseCase interface {
	Execute(ctx context.Context, bookingID, customerID string) (bookingdomain.Booking, error)
}

type Handler struct {
	holdBooking    HoldBookingUseCase
	confirmBooking ConfirmBookingUseCase
	requireSession gin.HandlerFunc
}

func NewHandler(holdBooking HoldBookingUseCase, confirmBooking ConfirmBookingUseCase, requireSession gin.HandlerFunc) *Handler {
	if requireSession == nil {
		panic("booking routes require session middleware")
	}
	return &Handler{holdBooking: holdBooking, confirmBooking: confirmBooking, requireSession: requireSession}
}

func (h *Handler) RegisterRoutes(routes *gin.RouterGroup) {
	protected := routes.Group("/bookings", h.requireSession)
	protected.POST("/holds", transporthttp.Wrap(h.hold))
	protected.POST("/:id/confirm", transporthttp.Wrap(h.confirm))
}

func (h *Handler) hold(c *gin.Context) (transporthttp.Result, error) {
	var request HoldBookingRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	if request.FromStop == nil || request.ToStop == nil {
		return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_request", Message: "from_stop and to_stop are required"}
	}

	booking, err := h.holdBooking.Execute(c.Request.Context(), bookingapp.HoldBookingCommand{
		CustomerID: transporthttp.UserID(c.Request.Context()),
		TripID:     request.TripID,
		SeatID:     request.SeatID,
		FromStop:   *request.FromStop,
		ToStop:     *request.ToStop,
	})
	if err != nil {
		return transporthttp.Result{}, mapBookingError(err)
	}

	return transporthttp.Result{Status: http.StatusCreated, Body: HoldBookingResponse{
		BookingID: booking.ID(),
		Status:    booking.Status().String(),
		ExpiresAt: booking.ExpiresAt(),
	}}, nil
}

func (h *Handler) confirm(c *gin.Context) (transporthttp.Result, error) {
	booking, err := h.confirmBooking.Execute(c.Request.Context(), c.Param("id"), transporthttp.UserID(c.Request.Context()))
	if err != nil {
		return transporthttp.Result{}, mapBookingError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: HoldBookingResponse{
		BookingID: booking.ID(),
		Status:    booking.Status().String(),
		ExpiresAt: booking.ExpiresAt(),
	}}, nil
}

func mapBookingError(err error) error {
	status := http.StatusInternalServerError
	code := "internal_error"
	message := "could not process booking"
	switch {
	case errors.Is(err, bookingapp.ErrInvalidHoldCommand), errors.Is(err, bookingapp.ErrInvalidBookingID),
		errors.Is(err, bookingdomain.ErrInvalidBooking), errors.Is(err, inventorydomain.ErrInvalidSegment):
		status, message = http.StatusBadRequest, "invalid booking request"
		code = "invalid_booking_request"
	case errors.Is(err, bookingapp.ErrBookingNotFound), errors.Is(err, bookingapp.ErrTripNotFound),
		errors.Is(err, inventorydomain.ErrSeatNotFound):
		status, message = http.StatusNotFound, "booking, trip, or seat was not found"
		code = "booking_resource_not_found"
	case errors.Is(err, inventorydomain.ErrSeatUnavailable):
		status, message = http.StatusConflict, "seat is unavailable for this segment"
		code = "seat_unavailable"
	case errors.Is(err, bookingdomain.ErrInvalidTransition), errors.Is(err, bookingdomain.ErrHoldExpired),
		errors.Is(err, inventorydomain.ErrReservationNotConfirmable):
		status, message = http.StatusConflict, "booking can no longer be confirmed"
		code = "booking_not_confirmable"
	}
	return &transporthttp.APIError{Status: status, Code: code, Message: message, Cause: err}
}
