package booking

import (
	"context"
	"errors"

	bookingapp "example.com/train-ticket/internal/booking/application"
	bookingdomain "example.com/train-ticket/internal/booking/domain"
	paymentapp "example.com/train-ticket/internal/payment/application"
	paymentdomain "example.com/train-ticket/internal/payment/domain"
)

type Gateway struct {
	repository bookingapp.BookingRepository
	confirm    *bookingapp.ConfirmBooking
}

var _ paymentapp.BookingGateway = (*Gateway)(nil)

func NewGateway(repository bookingapp.BookingRepository, confirm *bookingapp.ConfirmBooking) (*Gateway, error) {
	if repository == nil || confirm == nil {
		return nil, errors.New("booking gateway dependencies are required")
	}
	return &Gateway{repository: repository, confirm: confirm}, nil
}
func (g *Gateway) Lock(ctx context.Context, id string) (paymentapp.BookingSnapshot, error) {
	booking, err := g.repository.FindForUpdate(ctx, id)
	if err != nil {
		return paymentapp.BookingSnapshot{}, err
	}
	return paymentapp.BookingSnapshot{
		ID: booking.ID(), CustomerID: booking.CustomerID(), Status: booking.Status().String(),
		FareVND: booking.FareVND(), ExpiresAt: booking.ExpiresAt(),
	}, nil
}
func (g *Gateway) Confirm(ctx context.Context, id, customerID string) error {
	_, err := g.confirm.ConfirmInTransaction(ctx, id, customerID)
	if errors.Is(err, bookingdomain.ErrHoldExpired) || errors.Is(err, bookingdomain.ErrInvalidTransition) {
		return paymentdomain.ErrBookingUnavailable
	}
	return err
}
