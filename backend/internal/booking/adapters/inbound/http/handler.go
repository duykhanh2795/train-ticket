package http

import (
	"context"
	"errors"
	"net/http"

	bookingapp "example.com/train-ticket/internal/booking/application"
	bookingdomain "example.com/train-ticket/internal/booking/domain"
	inventorydomain "example.com/train-ticket/internal/inventory/domain"
	pricingapp "example.com/train-ticket/internal/pricing/application"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type HoldBookingUseCase interface {
	Execute(ctx context.Context, command bookingapp.HoldBookingCommand) (bookingdomain.Booking, error)
}

type ConfirmBookingUseCase interface {
	Execute(ctx context.Context, bookingID, customerID string) (bookingdomain.Booking, error)
}

type CancelBookingUseCase interface {
	Execute(ctx context.Context, bookingID, customerID string) (bookingdomain.Booking, error)
}

type Handler struct {
	holdBooking    HoldBookingUseCase
	confirmBooking ConfirmBookingUseCase
	cancelBooking  CancelBookingUseCase
	requireSession gin.HandlerFunc
}

func NewHandler(holdBooking HoldBookingUseCase, confirmBooking ConfirmBookingUseCase, cancelBooking CancelBookingUseCase, requireSession gin.HandlerFunc) *Handler {
	if holdBooking == nil || confirmBooking == nil || cancelBooking == nil || requireSession == nil {
		panic("booking routes require use cases and session middleware")
	}
	return &Handler{holdBooking: holdBooking, confirmBooking: confirmBooking, cancelBooking: cancelBooking, requireSession: requireSession}
}

func (h *Handler) RegisterRoutes(routes *gin.RouterGroup) {
	protected := routes.Group("/bookings", h.requireSession)
	protected.POST("/holds", transporthttp.Wrap(h.hold))
	protected.POST("/:id/confirm", transporthttp.Wrap(h.confirm))
	protected.POST("/:id/cancel", transporthttp.Wrap(h.cancel))
}

func (h *Handler) hold(c *gin.Context) (transporthttp.Result, error) {
	var request HoldBookingRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	if request.FromStop == nil || request.ToStop == nil {
		return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_request", Message: "from_stop and to_stop are required"}
	}
	if len(request.Passengers) == 0 && request.SeatID == "" {
		return transporthttp.Result{}, mapBookingError(bookingapp.ErrInvalidHoldCommand)
	}
	if len(request.Passengers) > 0 && request.SeatID != "" {
		return transporthttp.Result{}, mapBookingError(bookingapp.ErrInvalidHoldCommand)
	}
	passengers := make([]bookingapp.HoldPassenger, len(request.Passengers))
	for index, passenger := range request.Passengers {
		passengers[index] = bookingapp.HoldPassenger{SeatID: passenger.SeatID, FullName: passenger.FullName}
	}

	booking, err := h.holdBooking.Execute(c.Request.Context(), bookingapp.HoldBookingCommand{
		CustomerID: transporthttp.UserID(c.Request.Context()),
		TripID:     request.TripID,
		SeatID:     request.SeatID,
		Passengers: passengers,
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
		FareVND:   quotedFare(booking.FareVND()),
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
		FareVND:   quotedFare(booking.FareVND()),
	}}, nil
}

func (h *Handler) cancel(c *gin.Context) (transporthttp.Result, error) {
	booking, err := h.cancelBooking.Execute(c.Request.Context(), c.Param("id"), transporthttp.UserID(c.Request.Context()))
	if err != nil {
		return transporthttp.Result{}, mapBookingError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: HoldBookingResponse{
		BookingID: booking.ID(), Status: booking.Status().String(), ExpiresAt: booking.ExpiresAt(),
		FareVND: quotedFare(booking.FareVND()),
	}}, nil
}

func quotedFare(amount int64) *int64 {
	if amount == 0 {
		return nil
	}
	return &amount
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
		errors.Is(err, inventorydomain.ErrSeatNotFound), errors.Is(err, pricingapp.ErrSeatNotFound):
		status, message = http.StatusNotFound, "booking, trip, or seat was not found"
		code = "booking_resource_not_found"
	case errors.Is(err, inventorydomain.ErrSeatUnavailable):
		status, message = http.StatusConflict, "seat is unavailable for this segment"
		code = "seat_unavailable"
	case errors.Is(err, pricingapp.ErrFareUnavailable):
		status, message = http.StatusConflict, "fare is not configured for this journey"
		code = "fare_unavailable"
	case errors.Is(err, pricingapp.ErrInvalidFareRequest):
		status, message = http.StatusBadRequest, "invalid fare request"
		code = "invalid_fare_request"
	case errors.Is(err, bookingdomain.ErrInvalidTransition), errors.Is(err, bookingdomain.ErrHoldExpired),
		errors.Is(err, inventorydomain.ErrReservationNotConfirmable):
		status, message = http.StatusConflict, "booking state can no longer be changed"
		code = "booking_invalid_state"
	}
	return &transporthttp.APIError{Status: status, Code: code, Message: message, Cause: err}
}
