package application

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"example.com/train-ticket/internal/payment/domain"
)

type IPNResult string

const (
	IPNAccepted       IPNResult = "00"
	IPNDuplicate      IPNResult = "02"
	IPNNotFound       IPNResult = "01"
	IPNAmountMismatch IPNResult = "04"
	IPNRetry          IPNResult = "99"
)

type Settle struct {
	bookings BookingGateway
	attempts AttemptRepository
	tickets  TicketIssuer
	tx       UnitOfWork
	clock    Clock
}

func NewSettle(bookings BookingGateway, attempts AttemptRepository, tickets TicketIssuer, tx UnitOfWork, clock Clock) (*Settle, error) {
	if bookings == nil || attempts == nil || tickets == nil || tx == nil || clock == nil {
		return nil, errors.New("invalid payment settlement dependencies")
	}
	return &Settle{bookings: bookings, attempts: attempts, tickets: tickets, tx: tx, clock: clock}, nil
}

func (uc *Settle) Execute(ctx context.Context, notice domain.Notification) (IPNResult, error) {
	id, err := strconv.ParseInt(notice.TransactionRef, 10, 64)
	if err != nil || id <= 0 {
		return IPNNotFound, nil
	}
	// Read booking ID before taking locks. Both checkout and IPN lock booking
	// first and attempt second, preventing an inverted lock-order deadlock.
	snapshot, err := uc.attempts.FindByID(ctx, id)
	if errors.Is(err, domain.ErrNotFound) {
		return IPNNotFound, nil
	}
	if err != nil {
		return IPNRetry, err
	}
	var result IPNResult
	err = uc.tx.WithinTransaction(ctx, func(txCtx context.Context) error {
		booking, err := uc.bookings.Lock(txCtx, snapshot.BookingID)
		if err != nil {
			return err
		}
		attempt, err := uc.attempts.FindForUpdate(txCtx, id)
		if err != nil {
			return err
		}
		if attempt.AmountVND != notice.AmountVND {
			result = IPNAmountMismatch
			return nil
		}
		if attempt.Status != domain.StatusPending && !(attempt.Status == domain.StatusFailed && notice.Successful()) {
			result = IPNDuplicate
			return nil
		}
		wasFailed := attempt.Status == domain.StatusFailed
		now := uc.clock.Now().UTC()
		if notice.Successful() {
			attempt.ProviderTxnID = notice.ProviderPaymentID
		}
		attempt.ResponseCode = notice.ResponseCode
		attempt.TransactionStatus = notice.TransactionStatus
		attempt.UpdatedAt = now
		if !notice.Successful() {
			attempt.Status = domain.StatusFailed
		} else if wasFailed || booking.Status != "held" || !now.Before(booking.ExpiresAt) {
			attempt.Status = domain.StatusPaidUnfulfilled
		} else {
			ready, err := uc.tickets.Ready(txCtx, booking.ID)
			if err != nil {
				return fmt.Errorf("check ticket passengers for paid booking %q: %w", booking.ID, err)
			}
			if !ready {
				attempt.Status = domain.StatusPaidUnfulfilled
			} else {
				err := uc.bookings.Confirm(txCtx, booking.ID, booking.CustomerID)
				switch {
				case err == nil:
					if err := uc.tickets.IssueInTransaction(txCtx, booking.ID); err != nil {
						return fmt.Errorf("issue tickets for paid booking %q: %w", booking.ID, err)
					}
					attempt.Status = domain.StatusSucceeded
				case errors.Is(err, domain.ErrBookingUnavailable):
					attempt.Status = domain.StatusPaidUnfulfilled
				default:
					return fmt.Errorf("confirm paid booking: %w", err)
				}
			}
		}
		if err := uc.attempts.Settle(txCtx, attempt); err != nil {
			return err
		}
		result = IPNAccepted
		return nil
	})
	if err != nil {
		return IPNRetry, err
	}
	return result, nil
}
