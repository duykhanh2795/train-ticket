package application

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type deliveryTestClock struct{ at time.Time }

func (c deliveryTestClock) Now() time.Time { return c.at }

type deliveryTestRepository struct {
	job       DeliveryJob
	found     bool
	confirmed ConfirmationEmail
	sent      bool
	skipped   bool
	failed    bool
	terminal  bool
	code      string
	next      time.Time
}

func (r *deliveryTestRepository) Claim(context.Context, time.Time, time.Duration) (DeliveryJob, bool, error) {
	return r.job, r.found, nil
}
func (r *deliveryTestRepository) Confirmation(context.Context, string, string) (ConfirmationEmail, error) {
	return r.confirmed, nil
}
func (r *deliveryTestRepository) MarkSent(context.Context, DeliveryJob, time.Time) error {
	r.sent = true
	return nil
}
func (r *deliveryTestRepository) MarkSkipped(context.Context, DeliveryJob) error {
	r.skipped = true
	return nil
}
func (r *deliveryTestRepository) MarkFailed(_ context.Context, _ DeliveryJob, next time.Time, code string, terminal bool) error {
	r.failed, r.terminal, r.code, r.next = true, terminal, code, next
	return nil
}

type deliveryTestSender struct {
	message EmailMessage
	err     error
}

func (s *deliveryTestSender) Send(_ context.Context, message EmailMessage) error {
	s.message = message
	return s.err
}

func TestDeliverEmailConfirmed(t *testing.T) {
	at := time.Date(2026, time.October, 23, 8, 0, 0, 0, time.UTC)
	repo := &deliveryTestRepository{
		job:       DeliveryJob{ID: 1, BookingID: "booking-1", CustomerID: "customer-1", EventType: "booking.confirmed", EventID: "booking-1:booking.confirmed"},
		found:     true,
		confirmed: ConfirmationEmail{Recipient: "passenger@example.test", CustomerName: "Passenger", TrainNumber: "SE1", ServiceDate: "2026-10-24", OriginStation: "Hanoi", DestinationStation: "Saigon"},
	}
	sender := &deliveryTestSender{}
	useCase, err := NewDeliverEmail(repo, sender, deliveryTestClock{at}, "https://railway.example")
	if err != nil {
		t.Fatal(err)
	}
	count, err := useCase.RunOnce(context.Background())
	if err != nil || count != 1 || !repo.sent {
		t.Fatalf("delivery: count=%d err=%v sent=%v", count, err, repo.sent)
	}
	if sender.message.To != "passenger@example.test" || !strings.Contains(sender.message.Body, "https://railway.example/bookings/booking-1") {
		t.Fatalf("unexpected confirmation message: %+v", sender.message)
	}
}

func TestDeliverEmailSkipsOtherEvents(t *testing.T) {
	repo := &deliveryTestRepository{job: DeliveryJob{EventType: "booking.held"}, found: true}
	sender := &deliveryTestSender{}
	useCase, err := NewDeliverEmail(repo, sender, deliveryTestClock{time.Now()}, "http://localhost:3000")
	if err != nil {
		t.Fatal(err)
	}
	count, err := useCase.RunOnce(context.Background())
	if err != nil || count != 1 || !repo.skipped || repo.sent || sender.message.To != "" {
		t.Fatalf("skip: count=%d err=%v repo=%+v", count, err, repo)
	}
}

func TestDeliverEmailRetriesFailedSMTP(t *testing.T) {
	at := time.Date(2026, time.October, 23, 8, 0, 0, 0, time.UTC)
	repo := &deliveryTestRepository{job: DeliveryJob{EventType: "booking.confirmed", Attempts: 9}, found: true,
		confirmed: ConfirmationEmail{Recipient: "passenger@example.test"}}
	sender := &deliveryTestSender{err: errors.New("simulated SMTP rejection")}
	useCase, err := NewDeliverEmail(repo, sender, deliveryTestClock{at}, "http://localhost:3000")
	if err != nil {
		t.Fatal(err)
	}
	count, err := useCase.RunOnce(context.Background())
	if count != 1 || !errors.Is(err, ErrDeliveryAttempt) || !repo.failed || !repo.terminal || repo.code != "smtp_delivery_failed" || !repo.next.After(at) {
		t.Fatalf("failed delivery: count=%d err=%v repo=%+v", count, err, repo)
	}
}
