package domain

import (
	"errors"
	"strings"
	"time"
)

var ErrInvalidUser = errors.New("invalid user")

type User struct {
	id           string
	email        string
	fullName     string
	passwordHash string
	createdAt    time.Time
}

func NewUser(id, email, fullName, passwordHash string, createdAt time.Time) (User, error) {
	if strings.TrimSpace(id) == "" || strings.TrimSpace(email) == "" ||
		strings.TrimSpace(fullName) == "" || passwordHash == "" || createdAt.IsZero() {
		return User{}, ErrInvalidUser
	}
	return User{id: id, email: email, fullName: fullName, passwordHash: passwordHash, createdAt: createdAt}, nil
}

func (u User) ID() string           { return u.id }
func (u User) Email() string        { return u.email }
func (u User) FullName() string     { return u.fullName }
func (u User) PasswordHash() string { return u.passwordHash }
func (u User) CreatedAt() time.Time { return u.createdAt }
