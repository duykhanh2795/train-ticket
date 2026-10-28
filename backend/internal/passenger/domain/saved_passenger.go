package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalidSavedPassenger  = errors.New("invalid saved passenger")
	ErrSavedPassengerNotFound = errors.New("saved passenger not found")
)

type SavedPassenger struct {
	id        string
	ownerID   string
	fullName  string
	createdAt time.Time
}

func NewSavedPassenger(id, ownerID, fullName string, createdAt time.Time) (SavedPassenger, error) {
	if strings.TrimSpace(id) == "" || strings.TrimSpace(ownerID) == "" || createdAt.IsZero() {
		return SavedPassenger{}, ErrInvalidSavedPassenger
	}
	name, err := validFullName(fullName)
	if err != nil {
		return SavedPassenger{}, err
	}
	return SavedPassenger{id: id, ownerID: ownerID, fullName: name, createdAt: createdAt}, nil
}

func (p SavedPassenger) ID() string           { return p.id }
func (p SavedPassenger) OwnerID() string      { return p.ownerID }
func (p SavedPassenger) FullName() string     { return p.fullName }
func (p SavedPassenger) CreatedAt() time.Time { return p.createdAt }

func (p *SavedPassenger) Rename(fullName string) error {
	name, err := validFullName(fullName)
	if err != nil {
		return err
	}
	p.fullName = name
	return nil
}

func validFullName(fullName string) (string, error) {
	name := strings.TrimSpace(fullName)
	length := utf8.RuneCountInString(name)
	if length < 2 || length > 120 {
		return "", ErrInvalidSavedPassenger
	}
	return name, nil
}
