// Package mock provides a local-only checkout page for development payments.
package mock

import (
	"errors"
	"net"
	"net/url"
	"strconv"
	"strings"

	"example.com/train-ticket/internal/payment/domain"
)

type Gateway struct{ origin url.URL }

func NewGateway(rawOrigin string) (*Gateway, error) {
	origin, err := url.Parse(rawOrigin)
	if err != nil || origin == nil || origin.Scheme != "http" || origin.Host == "" || origin.User != nil || origin.RawQuery != "" || origin.Fragment != "" || (origin.Path != "" && origin.Path != "/") {
		return nil, errors.New("mock payment requires a local HTTP frontend origin")
	}
	host := origin.Hostname()
	ip := net.ParseIP(host)
	if !strings.EqualFold(host, "localhost") && (ip == nil || !ip.IsLoopback()) {
		return nil, errors.New("mock payment requires a loopback frontend origin")
	}
	return &Gateway{origin: *origin}, nil
}

func (g *Gateway) CheckoutURL(request domain.CheckoutRequest) (string, error) {
	id, err := strconv.ParseInt(request.TransactionRef, 10, 64)
	if err != nil || id <= 0 || request.AmountVND <= 0 {
		return "", errors.New("invalid mock payment checkout")
	}
	return g.urlForID(id), nil
}

func (g *Gateway) MatchesCheckoutURL(raw string, id int64) bool {
	return g != nil && id > 0 && raw == g.urlForID(id)
}

func (g *Gateway) urlForID(id int64) string {
	target := g.origin.ResolveReference(&url.URL{Path: "/payment/result"})
	params := target.Query()
	params.Set("payment_id", strconv.FormatInt(id, 10))
	params.Set("mock", "1")
	target.RawQuery = params.Encode()
	return target.String()
}
