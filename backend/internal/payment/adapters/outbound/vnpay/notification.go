package vnpay

import (
	"crypto/hmac"
	"encoding/hex"
	"errors"
	"net/url"
	"strconv"
	"strings"

	"example.com/train-ticket/internal/payment/domain"
)

type Notification = domain.Notification

// VerifyNotification authenticates VNPAY callback parameters. The caller must
// still compare the reference and amount with its own pending payment record.
func (c *Client) VerifyNotification(query url.Values) (Notification, error) {
	if c == nil {
		return Notification{}, errors.New("VNPAY client is required")
	}
	params := make(url.Values)
	for key, values := range query {
		if !strings.HasPrefix(key, "vnp_") {
			continue
		}
		if len(values) != 1 {
			return Notification{}, errors.New("duplicate VNPAY callback parameter")
		}
		if key != "vnp_SecureHash" && key != "vnp_SecureHashType" {
			params.Set(key, values[0])
		}
	}
	signature, err := hex.DecodeString(query.Get("vnp_SecureHash"))
	if err != nil || len(signature) != 64 {
		return Notification{}, errors.New("invalid VNPAY callback signature")
	}
	expected, _ := hex.DecodeString(c.sign(params.Encode()))
	if !hmac.Equal(signature, expected) {
		return Notification{}, errors.New("invalid VNPAY callback signature")
	}
	if params.Get("vnp_TmnCode") != c.tmnCode {
		return Notification{}, errors.New("unexpected VNPAY terminal code")
	}
	transactionRef := params.Get("vnp_TxnRef")
	if !transactionRefPattern.MatchString(transactionRef) {
		return Notification{}, errors.New("invalid VNPAY transaction reference")
	}
	amount, err := strconv.ParseInt(params.Get("vnp_Amount"), 10, 64)
	if err != nil || amount <= 0 || amount%100 != 0 {
		return Notification{}, errors.New("invalid VNPAY callback amount")
	}
	responseCode := params.Get("vnp_ResponseCode")
	transactionStatus := params.Get("vnp_TransactionStatus")
	if responseCode == "" || transactionStatus == "" {
		return Notification{}, errors.New("incomplete VNPAY callback status")
	}
	return Notification{
		TransactionRef:    transactionRef,
		AmountVND:         amount / 100,
		ProviderPaymentID: params.Get("vnp_TransactionNo"),
		ResponseCode:      responseCode,
		TransactionStatus: transactionStatus,
	}, nil
}
