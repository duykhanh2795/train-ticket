// Package vnpay implements the VNPAY PAY sandbox protocol. It only signs
// checkout URLs and verifies provider callbacks; booking state belongs to the
// payment and booking application use cases.
package vnpay

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"net"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"example.com/train-ticket/internal/payment/domain"
)

const sandboxPaymentURL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"

var transactionRefPattern = regexp.MustCompile(`^[A-Za-z0-9]{1,100}$`)

type Client struct {
	tmnCode    string
	hashSecret []byte
}

type CheckoutRequest = domain.CheckoutRequest

func NewClient(tmnCode, hashSecret string) (*Client, error) {
	if strings.TrimSpace(tmnCode) == "" || strings.TrimSpace(hashSecret) == "" {
		return nil, errors.New("VNPAY terminal code and hash secret are required")
	}
	return &Client{tmnCode: tmnCode, hashSecret: []byte(hashSecret)}, nil
}

// CheckoutURL signs the sorted VNPAY 2.1.0 query string with HMAC-SHA512.
func (c *Client) CheckoutURL(request CheckoutRequest) (string, error) {
	if c == nil || !transactionRefPattern.MatchString(request.TransactionRef) {
		return "", errors.New("invalid VNPAY transaction reference")
	}
	if request.AmountVND <= 0 || request.AmountVND > math.MaxInt64/100 {
		return "", errors.New("invalid VNPAY amount")
	}
	if strings.TrimSpace(request.OrderInfo) == "" || len(request.OrderInfo) > 255 {
		return "", errors.New("invalid VNPAY order information")
	}
	if err := ValidateReturnURL(request.ReturnURL); err != nil {
		return "", err
	}
	if net.ParseIP(request.ClientIP) == nil {
		return "", errors.New("invalid VNPAY client IP address")
	}
	if request.CreatedAt.IsZero() || !request.ExpiresAt.After(request.CreatedAt) {
		return "", errors.New("invalid VNPAY checkout times")
	}

	vietnamTime := time.FixedZone("ICT", 7*60*60)
	params := url.Values{
		"vnp_Version":    {"2.1.0"},
		"vnp_Command":    {"pay"},
		"vnp_TmnCode":    {c.tmnCode},
		"vnp_Amount":     {strconv.FormatInt(request.AmountVND*100, 10)},
		"vnp_CurrCode":   {"VND"},
		"vnp_TxnRef":     {request.TransactionRef},
		"vnp_OrderInfo":  {request.OrderInfo},
		"vnp_OrderType":  {"other"},
		"vnp_Locale":     {"vn"},
		"vnp_ReturnUrl":  {request.ReturnURL},
		"vnp_IpAddr":     {request.ClientIP},
		"vnp_CreateDate": {request.CreatedAt.In(vietnamTime).Format("20060102150405")},
		"vnp_ExpireDate": {request.ExpiresAt.In(vietnamTime).Format("20060102150405")},
	}
	signature := c.sign(params.Encode())
	params.Set("vnp_SecureHash", signature)
	return fmt.Sprintf("%s?%s", sandboxPaymentURL, params.Encode()), nil
}

func ValidateReturnURL(raw string) error {
	target, err := url.Parse(raw)
	if err != nil || !validReturnURL(target) {
		return errors.New("VNPAY return URL must be HTTPS or a local HTTP URL")
	}
	return nil
}

func (c *Client) sign(payload string) string {
	mac := hmac.New(sha512.New, c.hashSecret)
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func validReturnURL(target *url.URL) bool {
	if target == nil || target.Host == "" || target.User != nil || target.Fragment != "" {
		return false
	}
	if target.Scheme == "https" {
		return true
	}
	if target.Scheme != "http" {
		return false
	}
	if strings.EqualFold(target.Hostname(), "localhost") {
		return true
	}
	ip := net.ParseIP(target.Hostname())
	return ip != nil && ip.IsLoopback()
}
