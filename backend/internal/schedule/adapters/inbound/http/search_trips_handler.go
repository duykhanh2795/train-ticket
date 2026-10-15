package http

import (
	"context"
	"errors"
	"net/http"
	"time"

	scheduleapp "example.com/train-ticket/internal/schedule/application"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

// TripSearchUseCase is the inbound port consumed by the HTTP adapter.
type TripSearchUseCase interface {
	Execute(ctx context.Context, query scheduleapp.TripSearchQuery) ([]scheduleapp.TripSearchResult, error)
}

type SearchTripsHandler struct {
	searchTrips TripSearchUseCase
}

func NewSearchTripsHandler(searchTrips TripSearchUseCase) *SearchTripsHandler {
	return &SearchTripsHandler{searchTrips: searchTrips}
}

func (h *SearchTripsHandler) RegisterRoutes(routes *gin.RouterGroup) {
	routes.GET("/trips/search", transporthttp.Wrap(h.search))
}

type tripSearchRequest struct {
	OriginID      string `form:"origin_id" binding:"required,max=256"`
	DestinationID string `form:"destination_id" binding:"required,max=256"`
	ServiceDate   string `form:"service_date" binding:"required,len=10"`
}

func (h *SearchTripsHandler) search(c *gin.Context) (transporthttp.Result, error) {
	var request tripSearchRequest
	if err := c.ShouldBindQuery(&request); err != nil {
		return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_trip_search", Message: "origin_id, destination_id, and service_date are required"}
	}
	serviceDate, err := time.Parse("2006-01-02", request.ServiceDate)
	if err != nil {
		return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_service_date", Message: "service_date must use YYYY-MM-DD format"}
	}

	results, err := h.searchTrips.Execute(c.Request.Context(), scheduleapp.TripSearchQuery{
		OriginStationID:      request.OriginID,
		DestinationStationID: request.DestinationID,
		ServiceDate:          serviceDate,
	})
	if err != nil {
		if errors.Is(err, scheduleapp.ErrInvalidTripSearch) {
			return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusBadRequest, Code: "invalid_trip_search", Message: "origin_id and destination_id are required and must differ", Cause: err}
		}
		return transporthttp.Result{}, &transporthttp.APIError{Status: http.StatusInternalServerError, Code: "internal_error", Message: "could not search trips", Cause: err}
	}

	response := TripSearchResponse{Trips: make([]TripSearchItem, 0, len(results))}
	for _, result := range results {
		response.Trips = append(response.Trips, TripSearchItem{
			TripID:      result.TripID,
			TrainNumber: result.TrainNumber,
			ServiceDate: result.ServiceDate.Format("2006-01-02"),
			FromStop:    result.FromStop,
			ToStop:      result.ToStop,
			DepartureAt: result.DepartureAt,
			ArrivalAt:   result.ArrivalAt,
			FareFromVND: result.FareFromVND,
		})
	}
	return transporthttp.Result{Status: http.StatusOK, Body: response}, nil
}
