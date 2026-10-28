package domain

import (
	"errors"
	"time"
)

var (
	ErrNotFound                 = errors.New("payment attempt not found")
	ErrInvalidState             = errors.New("payment attempt state changed")
	ErrBookingUnavailable       = errors.New("booking is no longer available for payment")
	ErrPassengerDetailsRequired = errors.New("passenger details are required before payment")
)

type Status string

const (
	StatusPending         Status = "pending"
	StatusFailed          Status = "failed"
	StatusSucceeded       Status = "succeeded"
	StatusPaidUnfulfilled Status = "paid_unfulfilled"
)

type Attempt struct {
	ID                int64
	BookingID         string
	AmountVND         int64
	Status            Status
	CheckoutURL       string
	ProviderTxnID     string
	ResponseCode      string
	TransactionStatus string
	CreatedAt         time.Time
	ExpiresAt         time.Time
	UpdatedAt         time.Time
}
