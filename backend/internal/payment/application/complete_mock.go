package application

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"example.com/train-ticket/internal/payment/domain"
)

type MockCheckoutVerifier interface {
	MatchesCheckoutURL(string, int64) bool
}

// CompleteMock is only wired when the API is explicitly configured for local mock payments.
// It uses the same transactional settlement path as a verified provider notification.
type CompleteMock struct {
	read    *ReadAttempt
	settle  *Settle
	checker MockCheckoutVerifier
	clock   Clock
}

func NewCompleteMock(read *ReadAttempt, settle *Settle, checker MockCheckoutVerifier, clock Clock) (*CompleteMock, error) {
	if read == nil || settle == nil || checker == nil || clock == nil {
		return nil, errors.New("invalid mock payment dependencies")
	}
	return &CompleteMock{read: read, settle: settle, checker: checker, clock: clock}, nil
}

func (uc *CompleteMock) Execute(ctx context.Context, id int64, customerID string) (domain.Attempt, error) {
	attempt, err := uc.read.Execute(ctx, id, customerID)
	if err != nil {
		return domain.Attempt{}, err
	}
	if !uc.checker.MatchesCheckoutURL(attempt.CheckoutURL, id) {
		return domain.Attempt{}, domain.ErrNotFound
	}
	if attempt.Status != domain.StatusPending {
		return attempt, nil
	}
	if !uc.clock.Now().UTC().Before(attempt.ExpiresAt) {
		return domain.Attempt{}, domain.ErrBookingUnavailable
	}
	result, err := uc.settle.Execute(ctx, domain.Notification{
		TransactionRef:    strconv.FormatInt(id, 10),
		AmountVND:         attempt.AmountVND,
		ProviderPaymentID: fmt.Sprintf("mock-%d", id),
		ResponseCode:      "00",
		TransactionStatus: "00",
	})
	if err != nil {
		return domain.Attempt{}, err
	}
	if result != IPNAccepted && result != IPNDuplicate {
		return domain.Attempt{}, domain.ErrInvalidState
	}
	return uc.read.Execute(ctx, id, customerID)
}
