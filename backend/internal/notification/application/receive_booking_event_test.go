package application

import (
	"context"
	"errors"
	"testing"
	"time"
)

type inboxSpy struct{ called bool }

func (s *inboxSpy) Accept(context.Context, string, BookingEvent) (bool, error) {
	s.called = true
	return true, nil
}

func TestInvalidContractDoesNotReachInbox(t *testing.T) {
	base := BookingEvent{EventID: "b:booking.confirmed", EventType: "booking.confirmed", BookingID: "b", CustomerID: "c", TripID: "trip", Status: "confirmed", OccurredAt: time.Unix(123, 0)}
	for _, mutate := range []func(*BookingEvent){
		func(e *BookingEvent) { e.Status = "held" },
		func(e *BookingEvent) { e.EventID = "wrong" },
		func(e *BookingEvent) { e.EventType = "unknown" },
		func(e *BookingEvent) { e.OccurredAt = time.Time{} },
	} {
		event := base
		mutate(&event)
		spy := &inboxSpy{}
		usecase, err := NewReceiveBookingEvent(spy, "notification-v1")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := usecase.Execute(context.Background(), event); !errors.Is(err, ErrInvalidEvent) || spy.called {
			t.Fatalf("err=%v inbox called=%v", err, spy.called)
		}
	}
}
