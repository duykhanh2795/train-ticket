package http

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	bookingapp "example.com/train-ticket/internal/booking/application"
	bookingdomain "example.com/train-ticket/internal/booking/domain"
	inventorydomain "example.com/train-ticket/internal/inventory/domain"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type holdStub struct {
	called    bool
	failure   error
	requestID string
}

func (s *holdStub) Execute(ctx context.Context, cmd bookingapp.HoldBookingCommand) (bookingdomain.Booking, error) {
	s.called = true
	s.requestID = transporthttp.RequestID(ctx)
	if s.failure != nil {
		return bookingdomain.Booking{}, s.failure
	}
	now := time.Now()
	return bookingdomain.NewHeldBooking("b", cmd.CustomerID, cmd.TripID, now, now.Add(time.Minute), 100000)
}

type cancelStub struct{}

func (cancelStub) Execute(context.Context, string, string) (bookingdomain.Booking, error) {
	return bookingdomain.Booking{}, bookingapp.ErrBookingNotFound
}

func TestHoldValidationAndWrappedConflict(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		failure    error
		status     int
		called     bool
	}{
		{name: "zero is a valid origin", body: `{"customer_id":"c","trip_id":"t","seat_id":"s","from_stop":0,"to_stop":2}`, status: 201, called: true},
		{name: "missing origin", body: `{"customer_id":"c","trip_id":"t","seat_id":"s","to_stop":2}`, status: 400},
		{name: "negative origin", body: `{"customer_id":"c","trip_id":"t","seat_id":"s","from_stop":-1,"to_stop":2}`, status: 400},
		{name: "reversed range", body: `{"customer_id":"c","trip_id":"t","seat_id":"s","from_stop":2,"to_stop":1}`, status: 400},
		{name: "wrapped seat conflict", body: `{"customer_id":"c","trip_id":"t","seat_id":"s","from_stop":0,"to_stop":2}`, failure: fmt.Errorf("repository: %w", inventorydomain.ErrSeatUnavailable), status: 409, called: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hold := &holdStub{failure: tc.failure}
			router := transporthttp.NewRouter(slog.New(slog.NewTextHandler(io.Discard, nil)), NewHandler(hold, cancelStub{}, func(c *gin.Context) {
				c.Request = c.Request.WithContext(transporthttp.WithUserID(c.Request.Context(), "c"))
				c.Next()
			}))
			response := httptest.NewRecorder()
			request := httptest.NewRequest("POST", "/api/v1/bookings/holds", strings.NewReader(tc.body))
			request.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(response, request)
			if response.Code != tc.status || hold.called != tc.called {
				t.Fatalf("status=%d called=%v body=%s", response.Code, hold.called, response.Body.String())
			}
			if tc.called && hold.requestID == "" {
				t.Fatal("use case did not receive request context")
			}
			if tc.status == 409 {
				var body transporthttp.ErrorResponse
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if body.Code != "seat_unavailable" {
					t.Fatalf("code=%s", body.Code)
				}
			}
		})
	}
}
