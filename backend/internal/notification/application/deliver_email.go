package application

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"
)

const (
	deliveryLease       = time.Minute
	maxDeliveryAttempts = 10
)

var ErrDeliveryAttempt = errors.New("notification delivery attempt failed")

type DeliveryJob struct {
	ID         int64
	BookingID  string
	CustomerID string
	EventType  string
	EventID    string
	ClaimToken string
	Attempts   int32
}

type ConfirmationEmail struct {
	Recipient          string
	CustomerName       string
	TrainNumber        string
	ServiceDate        string
	OriginStation      string
	DestinationStation string
}

type EmailMessage struct {
	To      string
	Subject string
	Body    string
	EventID string
}

type DeliveryRepository interface {
	Claim(context.Context, time.Time, time.Duration) (DeliveryJob, bool, error)
	Confirmation(context.Context, string, string) (ConfirmationEmail, error)
	MarkSent(context.Context, DeliveryJob, time.Time) error
	MarkSkipped(context.Context, DeliveryJob) error
	MarkFailed(context.Context, DeliveryJob, time.Time, string, bool) error
}

type EmailSender interface {
	Send(context.Context, EmailMessage) error
}
type DeliveryClock interface{ Now() time.Time }

type DeliverEmail struct {
	repository DeliveryRepository
	sender     EmailSender
	clock      DeliveryClock
	publicURL  *url.URL
}

func NewDeliverEmail(repository DeliveryRepository, sender EmailSender, clock DeliveryClock, publicURL string) (*DeliverEmail, error) {
	parsed, err := url.Parse(publicURL)
	if repository == nil || sender == nil || clock == nil || err != nil || parsed == nil ||
		(parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
		return nil, errors.New("valid notification delivery dependencies and public URL are required")
	}
	return &DeliverEmail{repository: repository, sender: sender, clock: clock, publicURL: parsed}, nil
}

func (d *DeliverEmail) RunOnce(ctx context.Context) (int, error) {
	now := d.clock.Now().UTC()
	job, found, err := d.repository.Claim(ctx, now, deliveryLease)
	if err != nil {
		return 0, fmt.Errorf("claim notification job: %w", err)
	}
	if !found {
		return 0, nil
	}
	if job.EventType != "booking.confirmed" {
		if err := d.repository.MarkSkipped(ctx, job); err != nil {
			return 0, fmt.Errorf("skip notification job: %w", err)
		}
		return 1, nil
	}
	confirmation, err := d.repository.Confirmation(ctx, job.BookingID, job.CustomerID)
	if err != nil {
		return d.fail(ctx, job, now, "confirmation_unavailable")
	}
	ticketURL := d.publicURL.JoinPath("bookings", job.BookingID).String()
	message := EmailMessage{
		To:      confirmation.Recipient,
		EventID: job.EventID,
		Subject: "Your railway ticket is ready",
		Body:    fmt.Sprintf("Hello %s,\n\nYour booking is confirmed.\nTrain: %s\nDate: %s\nFrom: %s\nTo: %s\n\nOpen your tickets: %s\n\nPlease sign in with the account used for booking.\n", confirmation.CustomerName, confirmation.TrainNumber, confirmation.ServiceDate, confirmation.OriginStation, confirmation.DestinationStation, ticketURL),
	}
	sendCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	if err := d.sender.Send(sendCtx, message); err != nil {
		return d.fail(ctx, job, now, "smtp_delivery_failed")
	}
	if err := d.repository.MarkSent(ctx, job, d.clock.Now().UTC()); err != nil {
		return 0, fmt.Errorf("record sent notification: %w", err)
	}
	return 1, nil
}

func (d *DeliverEmail) fail(ctx context.Context, job DeliveryJob, at time.Time, code string) (int, error) {
	attempts := job.Attempts + 1
	delay := time.Minute * time.Duration(1<<min(attempts-1, 6))
	terminal := attempts >= maxDeliveryAttempts
	// Preserve the failure marker even when the original request was cancelled.
	saveCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := d.repository.MarkFailed(saveCtx, job, at.Add(delay), code, terminal); err != nil {
		return 0, fmt.Errorf("record failed notification attempt: %w", err)
	}
	return 1, ErrDeliveryAttempt
}
