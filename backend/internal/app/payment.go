package app

import (
	"errors"
	"net"
	"strings"

	bookingpostgres "example.com/train-ticket/internal/booking/adapters/outbound/postgres"
	"example.com/train-ticket/internal/config"
	paymenthttp "example.com/train-ticket/internal/payment/adapters/inbound/http"
	paymentbooking "example.com/train-ticket/internal/payment/adapters/outbound/booking"
	paymentmock "example.com/train-ticket/internal/payment/adapters/outbound/mock"
	paymentpostgres "example.com/train-ticket/internal/payment/adapters/outbound/postgres"
	"example.com/train-ticket/internal/payment/adapters/outbound/vnpay"
	paymentapp "example.com/train-ticket/internal/payment/application"
	platformclock "example.com/train-ticket/internal/platform/clock"
	platformid "example.com/train-ticket/internal/platform/id"
	ticketpostgres "example.com/train-ticket/internal/ticket/adapters/outbound/postgres"
	ticketapp "example.com/train-ticket/internal/ticket/application"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPaymentHandler(cfg config.Config, pool *pgxpool.Pool, bookingModule BookingModule, requireSession gin.HandlerFunc) (*paymenthttp.Handler, error) {
	attempts, err := paymentpostgres.NewRepository(pool)
	if err != nil {
		return nil, err
	}
	read := paymentapp.NewReadAttempt(attempts)
	var gateway paymentapp.Gateway
	var verifier paymenthttp.Verifier
	var mockGateway *paymentmock.Gateway
	returnURL := cfg.VNPAYReturnURL
	switch cfg.PaymentMode {
	case "", "vnpay":
		if cfg.VNPAYTMNCode == "" && cfg.VNPAYHashSecret == "" {
			return paymenthttp.NewHandler(nil, read, nil, nil, nil, requireSession), nil
		}
		if cfg.VNPAYTMNCode == "" || cfg.VNPAYHashSecret == "" || returnURL == "" {
			return nil, errors.New("VNPAY_TMN_CODE, VNPAY_HASH_SECRET and VNPAY_RETURN_URL must all be set")
		}
		client, err := vnpay.NewClient(cfg.VNPAYTMNCode, cfg.VNPAYHashSecret)
		if err != nil {
			return nil, err
		}
		if err := vnpay.ValidateReturnURL(returnURL); err != nil {
			return nil, err
		}
		gateway, verifier = client, client
	case "mock":
		host, _, err := net.SplitHostPort(cfg.HTTPAddress)
		if err != nil || (host != "localhost" && !isLoopbackIP(host)) {
			return nil, errors.New("mock payments require HTTP_ADDRESS bound to localhost or a loopback IP")
		}
		mockGateway, err = paymentmock.NewGateway(cfg.PublicAppURL)
		if err != nil {
			return nil, err
		}
		gateway = mockGateway
		returnURL = strings.TrimRight(cfg.PublicAppURL, "/") + "/payment/result"
	default:
		return nil, errors.New("PAYMENT_MODE must be vnpay or mock")
	}
	bookingRepository, err := bookingpostgres.NewBookingRepository(pool)
	if err != nil {
		return nil, err
	}
	bookingGateway, err := paymentbooking.NewGateway(bookingRepository, bookingModule.ConfirmBooking)
	if err != nil {
		return nil, err
	}
	tx, err := bookingpostgres.NewUnitOfWork(pool)
	if err != nil {
		return nil, err
	}
	clock := platformclock.SystemClock{}
	ticketRepository, err := ticketpostgres.NewTicketRepository(pool)
	if err != nil {
		return nil, err
	}
	issueTickets, err := ticketapp.NewIssueTickets(ticketRepository, platformid.UUIDGenerator{}, clock)
	if err != nil {
		return nil, err
	}
	checkout, err := paymentapp.NewCheckout(bookingGateway, attempts, issueTickets, tx, gateway, clock, returnURL)
	if err != nil {
		return nil, err
	}
	settle, err := paymentapp.NewSettle(bookingGateway, attempts, issueTickets, tx, clock)
	if err != nil {
		return nil, err
	}
	var completeMock paymenthttp.CompleteMockUseCase
	if mockGateway != nil {
		completeMock, err = paymentapp.NewCompleteMock(read, settle, mockGateway, clock)
		if err != nil {
			return nil, err
		}
	}
	return paymenthttp.NewHandler(checkout, read, settle, verifier, completeMock, requireSession), nil
}

func isLoopbackIP(host string) bool {
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
