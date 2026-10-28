package http

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"

	bookingapp "example.com/train-ticket/internal/booking/application"
	paymentapp "example.com/train-ticket/internal/payment/application"
	"example.com/train-ticket/internal/payment/domain"
	transporthttp "example.com/train-ticket/internal/transport/http"
	"github.com/gin-gonic/gin"
)

type CheckoutUseCase interface {
	Execute(context.Context, string, string, string) (domain.Attempt, error)
}
type ReadUseCase interface {
	Execute(context.Context, int64, string) (domain.Attempt, error)
}
type SettleUseCase interface {
	Execute(context.Context, domain.Notification) (paymentapp.IPNResult, error)
}
type CompleteMockUseCase interface {
	Execute(context.Context, int64, string) (domain.Attempt, error)
}
type Verifier interface {
	VerifyNotification(url.Values) (domain.Notification, error)
}

type Handler struct {
	checkout       CheckoutUseCase
	read           ReadUseCase
	settle         SettleUseCase
	verifier       Verifier
	completeMock   CompleteMockUseCase
	requireSession gin.HandlerFunc
}

func NewHandler(checkout CheckoutUseCase, read ReadUseCase, settle SettleUseCase, verifier Verifier, completeMock CompleteMockUseCase, requireSession gin.HandlerFunc) *Handler {
	return &Handler{checkout: checkout, read: read, settle: settle, verifier: verifier, completeMock: completeMock, requireSession: requireSession}
}
func (h *Handler) RegisterRoutes(routes *gin.RouterGroup) {
	protected := routes.Group("", transporthttp.NoStore(), h.requireSession)
	protected.POST("/bookings/:id/checkout", transporthttp.Wrap(h.startCheckout))
	protected.GET("/payments/:id", transporthttp.Wrap(h.get))
	if h.completeMock != nil {
		protected.POST("/payments/:id/mock/complete", transporthttp.Wrap(h.completeMockPayment))
	}
	if h.verifier != nil {
		routes.GET("/payments/vnpay/ipn", h.ipn)
	}
}

type checkoutResponse struct {
	PaymentID   int64         `json:"payment_id"`
	BookingID   string        `json:"booking_id"`
	AmountVND   int64         `json:"amount_vnd"`
	Status      domain.Status `json:"status"`
	CheckoutURL string        `json:"checkout_url"`
	ExpiresAt   string        `json:"expires_at"`
}
type statusResponse struct {
	PaymentID int64         `json:"payment_id"`
	BookingID string        `json:"booking_id"`
	AmountVND int64         `json:"amount_vnd"`
	Status    domain.Status `json:"status"`
	ExpiresAt string        `json:"expires_at"`
}

func (h *Handler) startCheckout(c *gin.Context) (transporthttp.Result, error) {
	if h.checkout == nil {
		return transporthttp.Result{}, unavailable()
	}
	attempt, err := h.checkout.Execute(c.Request.Context(), c.Param("id"), transporthttp.UserID(c.Request.Context()), c.ClientIP())
	if err != nil {
		return transporthttp.Result{}, mapPaymentError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: checkoutResponse{
		PaymentID: attempt.ID, BookingID: attempt.BookingID, AmountVND: attempt.AmountVND,
		Status: attempt.Status, CheckoutURL: attempt.CheckoutURL, ExpiresAt: attempt.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
	}}, nil
}
func (h *Handler) get(c *gin.Context) (transporthttp.Result, error) {
	if h.read == nil {
		return transporthttp.Result{}, unavailable()
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return transporthttp.Result{}, mapPaymentError(domain.ErrNotFound)
	}
	attempt, err := h.read.Execute(c.Request.Context(), id, transporthttp.UserID(c.Request.Context()))
	if err != nil {
		return transporthttp.Result{}, mapPaymentError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: statusResponse{
		PaymentID: attempt.ID, BookingID: attempt.BookingID, AmountVND: attempt.AmountVND,
		Status: attempt.Status, ExpiresAt: attempt.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
	}}, nil
}
func (h *Handler) completeMockPayment(c *gin.Context) (transporthttp.Result, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return transporthttp.Result{}, mapPaymentError(domain.ErrNotFound)
	}
	attempt, err := h.completeMock.Execute(c.Request.Context(), id, transporthttp.UserID(c.Request.Context()))
	if err != nil {
		return transporthttp.Result{}, mapPaymentError(err)
	}
	return transporthttp.Result{Status: http.StatusOK, Body: statusResponse{
		PaymentID: attempt.ID, BookingID: attempt.BookingID, AmountVND: attempt.AmountVND,
		Status: attempt.Status, ExpiresAt: attempt.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
	}}, nil
}
func (h *Handler) ipn(c *gin.Context) {
	if h.verifier == nil || h.settle == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"RspCode": "99", "Message": "payment unavailable"})
		return
	}
	notice, err := h.verifier.VerifyNotification(c.Request.URL.Query())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"RspCode": "97", "Message": "invalid signature or notification"})
		return
	}
	result, err := h.settle.Execute(c.Request.Context(), notice)
	if err != nil {
		_ = c.Error(err).SetType(gin.ErrorTypePrivate)
		c.JSON(http.StatusOK, gin.H{"RspCode": "99", "Message": "processing error"})
		return
	}
	messages := map[paymentapp.IPNResult]string{
		paymentapp.IPNAccepted: "processed", paymentapp.IPNDuplicate: "already processed",
		paymentapp.IPNNotFound: "payment not found", paymentapp.IPNAmountMismatch: "amount mismatch",
	}
	c.JSON(http.StatusOK, gin.H{"RspCode": result, "Message": messages[result]})
}
func unavailable() error {
	return &transporthttp.APIError{Status: http.StatusServiceUnavailable, Code: "payment_unavailable", Message: "payment is not configured"}
}
func mapPaymentError(err error) error {
	switch {
	case errors.Is(err, domain.ErrNotFound), errors.Is(err, bookingapp.ErrBookingNotFound):
		return &transporthttp.APIError{Status: http.StatusNotFound, Code: "payment_not_found", Message: "payment or booking was not found", Cause: err}
	case errors.Is(err, domain.ErrBookingUnavailable):
		return &transporthttp.APIError{Status: http.StatusConflict, Code: "booking_unavailable", Message: "booking hold has expired or is no longer payable", Cause: err}
	case errors.Is(err, domain.ErrPassengerDetailsRequired):
		return &transporthttp.APIError{Status: http.StatusConflict, Code: "passenger_details_required", Message: "passenger details are required for every seat before checkout", Cause: err}
	case errors.Is(err, domain.ErrInvalidState):
		return &transporthttp.APIError{Status: http.StatusConflict, Code: "payment_invalid_state", Message: "payment state changed; refresh and try again", Cause: err}
	default:
		return &transporthttp.APIError{Status: http.StatusInternalServerError, Code: "payment_error", Message: "could not process payment", Cause: err}
	}
}
