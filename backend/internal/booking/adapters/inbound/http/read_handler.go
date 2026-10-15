package http

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	bookingapp "example.com/train-ticket/internal/booking/application"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type BookingReadUseCase interface {
	List(ctx context.Context, customerID string, limit, offset int) (bookingapp.BookingPage, error)
	Get(ctx context.Context, customerID, bookingID string) (bookingapp.BookingView, error)
}

type ReadHandler struct {
	readBookings   BookingReadUseCase
	requireSession gin.HandlerFunc
}

func NewReadHandler(readBookings BookingReadUseCase, requireSession gin.HandlerFunc) *ReadHandler {
	if readBookings == nil || requireSession == nil {
		panic("booking read routes require a use case and session middleware")
	}
	return &ReadHandler{readBookings: readBookings, requireSession: requireSession}
}

func (h *ReadHandler) RegisterRoutes(routes *gin.RouterGroup) {
	protected := routes.Group("/bookings", h.requireSession)
	protected.GET("", transporthttp.Wrap(h.list))
	protected.GET("/:id", transporthttp.Wrap(h.get))
}

func (h *ReadHandler) list(c *gin.Context) (transporthttp.Result, error) {
	limit, err := queryInt(c, "limit", bookingapp.DefaultBookingPageSize)
	if err != nil {
		return transporthttp.Result{}, invalidBookingPage()
	}
	offset, err := queryInt(c, "offset", 0)
	if err != nil {
		return transporthttp.Result{}, invalidBookingPage()
	}
	page, err := h.readBookings.List(c.Request.Context(), transporthttp.UserID(c.Request.Context()), limit, offset)
	if err != nil {
		if errors.Is(err, bookingapp.ErrInvalidBookingPage) {
			return transporthttp.Result{}, invalidBookingPage()
		}
		return transporthttp.Result{}, mapBookingError(err)
	}
	items := make([]bookingViewResponse, 0, len(page.Items))
	for _, item := range page.Items {
		items = append(items, toBookingViewResponse(item))
	}
	c.Header("Cache-Control", "private, no-store")
	return transporthttp.Result{Status: http.StatusOK, Body: gin.H{
		"bookings": items, "has_more": page.HasMore, "limit": limit, "offset": offset,
	}}, nil
}

func (h *ReadHandler) get(c *gin.Context) (transporthttp.Result, error) {
	view, err := h.readBookings.Get(c.Request.Context(), transporthttp.UserID(c.Request.Context()), c.Param("id"))
	if err != nil {
		return transporthttp.Result{}, mapBookingError(err)
	}
	c.Header("Cache-Control", "private, no-store")
	return transporthttp.Result{Status: http.StatusOK, Body: toBookingViewResponse(view)}, nil
}

func queryInt(c *gin.Context, name string, fallback int) (int, error) {
	value := c.Query(name)
	if value == "" {
		return fallback, nil
	}
	return strconv.Atoi(value)
}

func invalidBookingPage() error {
	return &transporthttp.APIError{
		Status: http.StatusBadRequest, Code: "invalid_booking_page",
		Message: "limit must be 1 to 50 and offset must be non-negative",
	}
}

type bookingViewResponse struct {
	BookingID          string                `json:"booking_id"`
	TripID             string                `json:"trip_id"`
	Status             string                `json:"status"`
	CreatedAt          time.Time             `json:"created_at"`
	ExpiresAt          time.Time             `json:"expires_at"`
	FareVND            *int64                `json:"fare_vnd"`
	TrainNumber        string                `json:"train_number"`
	ServiceDate        string                `json:"service_date"`
	CoachNumber        string                `json:"coach_number"`
	SeatNumber         string                `json:"seat_number"`
	SeatType           string                `json:"seat_type"`
	FromStop           int                   `json:"from_stop"`
	ToStop             int                   `json:"to_stop"`
	OriginStation      string                `json:"origin_station"`
	DestinationStation string                `json:"destination_station"`
	Seats              []bookingSeatResponse `json:"seats"`
}

type bookingSeatResponse struct {
	SeatID      string `json:"seat_id"`
	CoachNumber string `json:"coach_number"`
	SeatNumber  string `json:"seat_number"`
	SeatType    string `json:"seat_type"`
	FullName    string `json:"full_name"`
}

func toBookingViewResponse(view bookingapp.BookingView) bookingViewResponse {
	seats := make([]bookingSeatResponse, 0, len(view.Seats))
	for _, seat := range view.Seats {
		seats = append(seats, bookingSeatResponse{
			SeatID: seat.SeatID, CoachNumber: seat.CoachNumber,
			SeatNumber: seat.SeatNumber, SeatType: seat.SeatType, FullName: seat.FullName,
		})
	}
	return bookingViewResponse{
		BookingID: view.BookingID, TripID: view.TripID, Status: view.Status,
		CreatedAt: view.CreatedAt, ExpiresAt: view.ExpiresAt,
		FareVND:     view.FareVND,
		TrainNumber: view.TrainNumber, ServiceDate: view.ServiceDate,
		CoachNumber: view.CoachNumber, SeatNumber: view.SeatNumber, SeatType: view.SeatType,
		FromStop: view.FromStop, ToStop: view.ToStop,
		OriginStation: view.OriginStation, DestinationStation: view.DestinationStation,
		Seats: seats,
	}
}
