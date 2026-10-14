package http

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	inventoryapp "example.com/train-ticket/internal/inventory/application"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type SeatListingUseCase interface {
	Execute(ctx context.Context, tripID string, fromStop, toStop int) ([]inventoryapp.SeatAvailability, error)
}

type ListSeatsHandler struct {
	listSeats SeatListingUseCase
}

func NewListSeatsHandler(listSeats SeatListingUseCase) *ListSeatsHandler {
	return &ListSeatsHandler{listSeats: listSeats}
}

func (h *ListSeatsHandler) RegisterRoutes(routes *gin.RouterGroup) {
	routes.GET("/trips/:id/seats", transporthttp.Wrap(h.list))
}

func (h *ListSeatsHandler) list(c *gin.Context) (transporthttp.Result, error) {
	fromStop, fromErr := strconv.Atoi(c.Query("from_stop"))
	toStop, toErr := strconv.Atoi(c.Query("to_stop"))
	if fromErr != nil || toErr != nil {
		return transporthttp.Result{}, invalidSeatSearch()
	}

	seats, err := h.listSeats.Execute(c.Request.Context(), c.Param("id"), fromStop, toStop)
	if err != nil {
		if errors.Is(err, inventoryapp.ErrInvalidSeatSearch) {
			return transporthttp.Result{}, invalidSeatSearch()
		}
		return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusInternalServerError, Code: "internal_error", Message: "could not list seats", Cause: err}
	}

	response := make([]gin.H, 0, len(seats))
	for _, seat := range seats {
		response = append(response, gin.H{
			"seat_id":      seat.SeatID,
			"coach_number": seat.CoachNumber,
			"seat_number":  seat.SeatNumber,
			"seat_type":    seat.SeatType,
			"available":    seat.Available,
		})
	}
	return transporthttp.Result{Status: http.StatusOK, Body: gin.H{"seats": response}}, nil
}

func invalidSeatSearch() error {
	return &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_seat_search", Message: "trip_id, from_stop, and to_stop must describe a valid segment"}
}
