	package application

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"example.com/train-ticket/internal/auth/domain"
)

var (
	ErrInvalidRegistration = errors.New("invalid registration")
	ErrEmailTaken          = errors.New("email is already registered")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrUnauthenticated     = errors.New("session is missing or expired")
)

const SessionDuration = 7 * 24 * time.Hour

type Repository interface {
	CreateUserWithSession(ctx context.Context, user domain.User, tokenHash string, expiresAt time.Time) error
	FindUserByEmail(ctx context.Context, email string) (domain.User, error)
	CreateSession(ctx context.Context, userID, tokenHash string, createdAt, expiresAt time.Time) error
	FindSessionUser(ctx context.Context, tokenHash string, at time.Time) (domain.User, error)
	DeleteSession(ctx context.Context, tokenHash string) error
}

type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash, password string) bool
}

type TokenGenerator interface{ NewToken() (string, error) }
type IDGenerator interface{ NewID() (string, error) }
type Clock interface{ Now() time.Time }

type Service struct {
	repository Repository
	passwords  PasswordHasher
	tokens     TokenGenerator
	ids        IDGenerator
	clock      Clock
	dummyHash  string
}

func NewService(repository Repository, passwords PasswordHasher, tokens TokenGenerator, ids IDGenerator, clock Clock) (*Service, error) {
	if repository == nil || passwords == nil || tokens == nil || ids == nil || clock == nil {
		return nil, errors.New("auth dependencies are required")
	}
	dummyHash, err := passwords.Hash("unused-auth-timing-password")
	if err != nil {
		return nil, fmt.Errorf("prepare password verification: %w", err)
	}
	return &Service{repository: repository, passwords: passwords, tokens: tokens, ids: ids, clock: clock, dummyHash: dummyHash}, nil
}

type RegisterCommand struct{ Email, FullName, Password string }
type Credentials struct{ Email, Password string }
type Session struct {
	User      domain.User
	Token     string
	ExpiresAt time.Time
}

func (s *Service) Register(ctx context.Context, command RegisterCommand) (Session, error) {
	email := normalizedEmail(command.Email)
	fullName := strings.TrimSpace(command.FullName)
	if !validEmail(email) || len(fullName) < 2 || len(fullName) > 100 || !validPassword(command.Password) {
		return Session{}, ErrInvalidRegistration
	}
	passwordHash, err := s.passwords.Hash(command.Password)
	if err != nil {
		return Session{}, fmt.Errorf("hash password: %w", err)
	}
	id, err := s.ids.NewID()
	if err != nil {
		return Session{}, fmt.Errorf("create user ID: %w", err)
	}
	now := s.clock.Now()
	user, err := domain.NewUser(id, email, fullName, passwordHash, now)
	if err != nil {
		return Session{}, err
	}
	token, err := s.tokens.NewToken()
	if err != nil {
		return Session{}, fmt.Errorf("create session token: %w", err)
	}
	expiresAt := now.Add(SessionDuration)
	if err := s.repository.CreateUserWithSession(ctx, user, TokenHash(token), expiresAt); err != nil {
		return Session{}, fmt.Errorf("register user: %w", err)
	}
	return Session{User: user, Token: token, ExpiresAt: expiresAt}, nil
}

func (s *Service) Login(ctx context.Context, credentials Credentials) (Session, error) {
	email := normalizedEmail(credentials.Email)
	if !validEmail(email) || credentials.Password == "" || len(credentials.Password) > 72 {
		return Session{}, ErrInvalidCredentials
	}
	user, err := s.repository.FindUserByEmail(ctx, email)
	if errors.Is(err, ErrInvalidCredentials) {
		s.passwords.Compare(s.dummyHash, credentials.Password)
		return Session{}, ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, fmt.Errorf("find user: %w", err)
	}
	if !s.passwords.Compare(user.PasswordHash(), credentials.Password) {
		return Session{}, ErrInvalidCredentials
	}
	token, err := s.tokens.NewToken()
	if err != nil {
		return Session{}, fmt.Errorf("create session token: %w", err)
	}
	now := s.clock.Now()
	expiresAt := now.Add(SessionDuration)
	if err := s.repository.CreateSession(ctx, user.ID(), TokenHash(token), now, expiresAt); err != nil {
		return Session{}, fmt.Errorf("create session: %w", err)
	}
	return Session{User: user, Token: token, ExpiresAt: expiresAt}, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (domain.User, error) {
	if token == "" {
		return domain.User{}, ErrUnauthenticated
	}
	user, err := s.repository.FindSessionUser(ctx, TokenHash(token), s.clock.Now())
	if errors.Is(err, ErrUnauthenticated) {
		return domain.User{}, ErrUnauthenticated
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("find session: %w", err)
	}
	return user, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	if err := s.repository.DeleteSession(ctx, TokenHash(token)); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func TokenHash(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func normalizedEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }
func validEmail(email string) bool {
	if len(email) < 3 || len(email) > 254 {
		return false
	}
	address, err := mail.ParseAddress(email)
	return err == nil && address.Address == email
}
func validPassword(password string) bool { return len(password) >= 12 && len(password) <= 72 }
