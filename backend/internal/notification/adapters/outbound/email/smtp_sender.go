package email

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	stdmail "net/mail"
	"strings"
	"time"

	notificationapp "example.com/train-ticket/internal/notification/application"
	mail "github.com/wneessen/go-mail"
)

type SMTPConfig struct {
	Host     string
	Port     int
	Mode     string // starttls, implicit, or none for local development only
	Username string
	Password string
	From     string
}

type SMTPSender struct {
	config     SMTPConfig
	fromDomain string
}

var _ notificationapp.EmailSender = (*SMTPSender)(nil)

func NewSMTPSender(config SMTPConfig) (*SMTPSender, error) {
	address, err := stdmail.ParseAddress(config.From)
	if config.Host == "" || config.Port < 1 || config.Port > 65535 || err != nil || address.Address != config.From ||
		(config.Username == "") != (config.Password == "") {
		return nil, errors.New("valid SMTP host, port, sender and paired credentials are required")
	}
	if config.Mode != "starttls" && config.Mode != "implicit" && config.Mode != "none" {
		return nil, errors.New("SMTP mode must be starttls, implicit or none")
	}
	if config.Mode == "none" {
		if config.Username != "" || !isLoopbackHost(config.Host) {
			return nil, errors.New("unencrypted SMTP is permitted only without credentials on loopback")
		}
	}
	parts := strings.Split(address.Address, "@")
	return &SMTPSender{config: config, fromDomain: parts[len(parts)-1]}, nil
}

func isLoopbackHost(host string) bool {
	return strings.EqualFold(host, "localhost") || net.ParseIP(host) != nil && net.ParseIP(host).IsLoopback()
}

func (s *SMTPSender) Send(ctx context.Context, message notificationapp.EmailMessage) error {
	msg := mail.NewMsg()
	if err := msg.From(s.config.From); err != nil {
		return fmt.Errorf("set sender: %w", err)
	}
	if err := msg.To(message.To); err != nil {
		return fmt.Errorf("set recipient: %w", err)
	}
	msg.Subject(message.Subject)
	msg.SetBodyString(mail.TypeTextPlain, message.Body)
	digest := sha256.Sum256([]byte(message.EventID))
	msg.SetMessageIDWithValue(hex.EncodeToString(digest[:16]) + "@" + s.fromDomain)
	options := []mail.Option{mail.WithPort(s.config.Port), mail.WithTimeout(20 * time.Second)}
	switch s.config.Mode {
	case "implicit":
		options = append(options, mail.WithSSL())
	case "none":
		options = append(options, mail.WithTLSPolicy(mail.NoTLS))
	default:
		options = append(options, mail.WithTLSPolicy(mail.TLSMandatory))
	}
	if s.config.Username != "" {
		options = append(options, mail.WithSMTPAuth(mail.SMTPAuthAutoDiscover), mail.WithUsername(s.config.Username), mail.WithPassword(s.config.Password))
	}
	client, err := mail.NewClient(s.config.Host, options...)
	if err != nil {
		return errors.New("create SMTP client failed")
	}
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return errors.New("SMTP send failed")
	}
	return nil
}
