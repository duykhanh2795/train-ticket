package application

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"example.com/train-ticket/internal/payment/domain"
)

type Checkout struct {
	bookings  BookingGateway
	attempts  AttemptRepository
	tickets   TicketEligibility
	tx        UnitOfWork
	gateway   Gateway
	clock     Clock
	returnURL string
}

func NewCheckout(bookings BookingGateway, attempts AttemptRepository, tickets TicketEligibility, tx UnitOfWork, gateway Gateway, clock Clock, returnURL string) (*Checkout, error) {
	if bookings == nil || attempts == nil || tickets == nil || tx == nil || gateway == nil || clock == nil || returnURL == "" {
		return nil, errors.New("invalid payment checkout dependencies")
	}
	return &Checkout{bookings: bookings, attempts: attempts, tickets: tickets, tx: tx, gateway: gateway, clock: clock, returnURL: returnURL}, nil
}

func (uc *Checkout) Execute(ctx context.Context, bookingID, customerID, clientIP string) (domain.Attempt, error) {
	if bookingID == "" || customerID == "" {
		return domain.Attempt{}, domain.ErrNotFound
	}
	var result domain.Attempt
	err := uc.tx.WithinTransaction(ctx, func(txCtx context.Context) error {
		booking, err := uc.bookings.Lock(txCtx, bookingID)
		if err != nil {
			return err
		}
		if booking.CustomerID != customerID {
			return domain.ErrNotFound
		}
		now := uc.clock.Now().UTC()
		if booking.Status != "held" || !now.Before(booking.ExpiresAt) || booking.FareVND <= 0 {
			return domain.ErrBookingUnavailable
		}
		ready, err := uc.tickets.Ready(txCtx, bookingID)
		if err != nil {
			return fmt.Errorf("check ticket passengers: %w", err)
		}
		if !ready {
			return domain.ErrPassengerDetailsRequired
		}
		pending, err := uc.attempts.FindPendingForBooking(txCtx, bookingID)
		if err == nil {
			result = pending
			return nil
		}
		if !errors.Is(err, domain.ErrNotFound) {
			return err
		}
		attempt, err := uc.attempts.Create(txCtx, bookingID, booking.FareVND, now, booking.ExpiresAt)
		if err != nil {
			return err
		}
		checkoutURL, err := uc.gateway.CheckoutURL(domain.CheckoutRequest{
			TransactionRef: strconv.FormatInt(attempt.ID, 10),
			AmountVND:      attempt.AmountVND,
			OrderInfo:      fmt.Sprintf("Thanh toan ve tau %s", bookingID),
			ReturnURL:      uc.returnURL,
			ClientIP:       clientIP,
			CreatedAt:      now,
			ExpiresAt:      booking.ExpiresAt,
		})
		if err != nil {
			return fmt.Errorf("create payment checkout URL: %w", err)
		}
		if err := uc.attempts.SaveCheckoutURL(txCtx, attempt.ID, checkoutURL); err != nil {
			return err
		}
		attempt.CheckoutURL = checkoutURL
		result = attempt
		return nil
	})
	if err != nil {
		return domain.Attempt{}, fmt.Errorf("create checkout: %w", err)
	}
	return result, nil
}

type ReadAttempt struct{ attempts AttemptRepository }

func NewReadAttempt(attempts AttemptRepository) *ReadAttempt {
	return &ReadAttempt{attempts: attempts}
}

func (uc *ReadAttempt) Execute(ctx context.Context, id int64, customerID string) (domain.Attempt, error) {
	if id <= 0 || customerID == "" {
		return domain.Attempt{}, domain.ErrNotFound
	}
	return uc.attempts.FindOwnedByID(ctx, id, customerID)
}
