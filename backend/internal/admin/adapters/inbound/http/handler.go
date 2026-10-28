package http

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"example.com/train-ticket/internal/admin/application"
	"example.com/train-ticket/internal/admin/domain"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service        *application.Service
	requireSession gin.HandlerFunc
}

func NewHandler(service *application.Service, requireSession gin.HandlerFunc) *Handler {
	return &Handler{service: service, requireSession: requireSession}
}

func (h *Handler) RegisterRoutes(routes *gin.RouterGroup) {
	admin := routes.Group("/admin", transporthttp.NoStore(), h.requireSession, h.requireAdmin)
	admin.GET("/me", transporthttp.Wrap(func(c *gin.Context) (transporthttp.Result, error) {
		return transporthttp.Result{Status: http.StatusOK, Body: gin.H{"is_admin": true}}, nil
	}))
	admin.GET("/stations", transporthttp.Wrap(h.listStations))
	admin.POST("/stations", transporthttp.Wrap(h.createStation))
	admin.GET("/trips", transporthttp.Wrap(h.listTrips))
	admin.POST("/trips", transporthttp.Wrap(h.createTrip))
	admin.GET("/bookings", transporthttp.Wrap(h.listBookings))
}

func (h *Handler) requireAdmin(c *gin.Context) {
	ok, err := h.service.IsAdmin(c.Request.Context(), transporthttp.UserID(c.Request.Context()))
	if err != nil {
		transporthttp.WriteError(c, &transporthttp.APIError{Status: 500, Code: "internal_error", Message: "could not verify admin permission", Cause: err})
		return
	}
	if !ok {
		transporthttp.WriteError(c, &transporthttp.APIError{Status: 403, Code: "forbidden", Message: "admin permission required"})
		return
	}
	c.Next()
}

func (h *Handler) listStations(c *gin.Context) (transporthttp.Result, error) {
	items, err := h.service.ListStations(c.Request.Context())
	if err != nil {
		return transporthttp.Result{}, err
	}
	return transporthttp.Result{Status: 200, Body: gin.H{"stations": items}}, nil
}

func (h *Handler) createStation(c *gin.Context) (transporthttp.Result, error) {
	var station domain.Station
	if err := c.ShouldBindJSON(&station); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	station.Code = strings.ToUpper(strings.TrimSpace(station.Code))
	station.Name = strings.TrimSpace(station.Name)
	station.City = strings.TrimSpace(station.City)
	if err := h.service.CreateStation(c.Request.Context(), station); err != nil {
		return transporthttp.Result{}, mapError(err)
	}
	return transporthttp.Result{Status: 201, Body: gin.H{"id": station.Code}}, nil
}

func (h *Handler) listTrips(c *gin.Context) (transporthttp.Result, error) {
	limit, offset, err := pagination(c)
	if err != nil {
		return transporthttp.Result{}, err
	}
	items, err := h.service.ListTrips(c.Request.Context(), limit, offset)
	if err != nil {
		return transporthttp.Result{}, err
	}
	return transporthttp.Result{Status: 200, Body: gin.H{"trips": items}}, nil
}

type createTripRequest struct {
	TrainNumber string             `json:"train_number"`
	ServiceDate string             `json:"service_date"`
	Stops       []domain.Stop      `json:"stops"`
	SeatGroups  []domain.SeatGroup `json:"seat_groups"`
	Fares       []domain.Fare      `json:"fares"`
}

func (h *Handler) createTrip(c *gin.Context) (transporthttp.Result, error) {
	var req createTripRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		return transporthttp.Result{}, transporthttp.InvalidBody(err)
	}
	date, err := time.Parse("2006-01-02", req.ServiceDate)
	if err != nil {
		return transporthttp.Result{}, mapError(domain.ErrInvalidCatalog)
	}
	trip := domain.Trip{TrainNumber: strings.TrimSpace(req.TrainNumber), ServiceDate: date, Stops: req.Stops, SeatGroups: req.SeatGroups, Fares: req.Fares}
	for i := range trip.Stops {
		trip.Stops[i].StationID = strings.ToUpper(strings.TrimSpace(trip.Stops[i].StationID))
	}
	for i := range trip.SeatGroups {
		trip.SeatGroups[i].CoachNumber = strings.ToUpper(strings.TrimSpace(trip.SeatGroups[i].CoachNumber))
	}
	id, err := h.service.CreateTrip(c.Request.Context(), trip)
	if err != nil {
		return transporthttp.Result{}, mapError(err)
	}
	return transporthttp.Result{Status: 201, Body: gin.H{"id": id}}, nil
}

func (h *Handler) listBookings(c *gin.Context) (transporthttp.Result, error) {
	limit, offset, err := pagination(c)
	if err != nil {
		return transporthttp.Result{}, err
	}
	items, err := h.service.ListBookings(c.Request.Context(), limit, offset)
	if err != nil {
		return transporthttp.Result{}, err
	}
	return transporthttp.Result{Status: 200, Body: gin.H{"bookings": items}}, nil
}

func pagination(c *gin.Context) (int32, int32, error) {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if err != nil || limit < 1 || limit > 100 {
		return 0, 0, transporthttp.InvalidBody(errors.New("limit must be between 1 and 100"))
	}
	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 || offset > 1000000 {
		return 0, 0, transporthttp.InvalidBody(errors.New("invalid offset"))
	}
	return int32(limit), int32(offset), nil
}

func mapError(err error) error {
	switch {
	case errors.Is(err, domain.ErrInvalidCatalog):
		return &transporthttp.APIError{Status: 400, Code: "invalid_catalog", Message: "station, trip, seats or fares are invalid"}
	case errors.Is(err, domain.ErrConflict):
		return &transporthttp.APIError{Status: 409, Code: "catalog_conflict", Message: "catalog entry already exists"}
	default:
		return err
	}
}
