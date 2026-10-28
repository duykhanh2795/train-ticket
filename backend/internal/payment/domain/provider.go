package domain

import "time"

type CheckoutRequest struct {
	TransactionRef string
	AmountVND      int64
	OrderInfo      string
	ReturnURL      string
	ClientIP       string
	CreatedAt      time.Time
	ExpiresAt      time.Time
}

type Notification struct {
	TransactionRef    string
	AmountVND         int64
	ProviderPaymentID string
	ResponseCode      string
	TransactionStatus string
}

func (n Notification) Successful() bool {
	return n.ResponseCode == "00" && n.TransactionStatus == "00"
}
