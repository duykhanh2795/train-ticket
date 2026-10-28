package http

import (
	"context"
	"errors"
	"net/http"

	passengerapp "example.com/train-ticket/internal/passenger/application"
	"example.com/train-ticket/internal/passenger/domain"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type PassengerUseCase interface {
	Create(context.Context, passengerapp.CreateSavedPassengerCommand) (domain.SavedPassenger, error)
	List(context.Context, string) ([]domain.SavedPassenger, error)
	Rename(context.Context, string, string, string) (domain.SavedPassenger, error)
	Delete(context.Context, string, string) error
}

type Handler struct {
	passengers     PassengerUseCase
	requireSession gin.HandlerFunc
}

func NewHandler(passengers PassengerUseCase, requireSession gin.HandlerFunc) *Handler {
	if passengers == nil || requireSession == nil {
		panic("saved passenger routes require a use case and session middleware")
	}
	return &Handler{passengers: passengers, requireSession: requireSession}
}

func (h *Handler) RegisterRoutes(routes *gin.RouterGroup) {
	protected := routes.Group("/saved-passengers", transporthttp.NoStore(), h.requireSession)

	protected.POST("", transporthttp.Wrap(h.create))
	protected.GET("", transporthttp.Wrap(h.list))
	protected.PATCH("/:id", transporthttp.Wrap(h.rename))
	protected.DELETE("/:id", transporthttp.Wrap(h.delete))
}

func (h *Handler) create(c *gin.Context) (transporthttp.Result, error) {
	var request createPassengerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}

	passenger, err := h.passengers.Create(
		c.Request.Context(),
		passengerapp.CreateSavedPassengerCommand{
			OwnerID:  transporthttp.UserID(c.Request.Context()),
			FullName: request.FullName,
		},
	)
	if err != nil {
		return transporthttp.Result{}, mapPassengerError(err)
	}

	return transporthttp.Result{
		Status: http.StatusCreated,
		Body:   toPassengerResponse(passenger),
	}, nil
}

func (h *Handler) rename(c *gin.Context) (transporthttp.Result, error) {
	var request renamePassengerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}

	ctx := c.Request.Context()
	passenger, err := h.passengers.Rename(ctx, transporthttp.UserID(ctx), c.Param("id"), request.FullName)
	if err != nil {
		return transporthttp.Result{}, mapPassengerError(err)
	}

	return transporthttp.Result{Status: http.StatusOK, Body: toPassengerResponse(passenger)}, nil
}

func (h *Handler) delete(c *gin.Context) (transporthttp.Result, error) {
	ctx := c.Request.Context()
	if err := h.passengers.Delete(ctx, transporthttp.UserID(ctx), c.Param("id")); err != nil {
		return transporthttp.Result{}, mapPassengerError(err)
	}

	return transporthttp.Result{Status: http.StatusOK, Body: gin.H{"status": "deleted"}}, nil
}

func mapPassengerError(err error) error {
	switch {
	case errors.Is(err, domain.ErrInvalidSavedPassenger):
		return &transporthttp.APIError{
			Status: http.StatusBadRequest, Code: "invalid_saved_passenger",
			Message: "saved passenger details are invalid", Cause: err,
		}
	case errors.Is(err, domain.ErrSavedPassengerNotFound):
		return &transporthttp.APIError{
			Status: http.StatusNotFound, Code: "saved_passenger_not_found",
			Message: "saved passenger was not found", Cause: err,
		}
	default:
		return &transporthttp.APIError{
			Status: http.StatusInternalServerError, Code: "internal_error",
			Message: "could not process saved passenger", Cause: err,
		}
	}
}

func (h *Handler) list(c *gin.Context) (transporthttp.Result, error) {
	ctx := c.Request.Context()
	passengers, err := h.passengers.List(ctx, transporthttp.UserID(ctx))
	if err != nil {
		return transporthttp.Result{}, mapPassengerError(err)
	}

	items := make([]passengerResponse, 0, len(passengers))
	for _, passenger := range passengers {
		items = append(items, toPassengerResponse(passenger))
	}

	return transporthttp.Result{
		Status: http.StatusOK,
		Body:   gin.H{"passengers": items},
	}, nil
}
