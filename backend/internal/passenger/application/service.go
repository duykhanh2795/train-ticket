package application

import (
	"context"
	"errors"
	"fmt"

	"example.com/train-ticket/internal/passenger/domain"
)

type CreateSavedPassengerCommand struct {
	OwnerID  string
	FullName string
}

type Service struct {
	repository SavedPassengerRepository
	ids        IDGenerator
	clock      Clock
}

func NewService(repository SavedPassengerRepository, ids IDGenerator, clock Clock) (*Service, error) {
	if repository == nil || ids == nil || clock == nil {
		return nil, errors.New("saved passenger dependencies are required")
	}
	return &Service{repository: repository, ids: ids, clock: clock}, nil
}

func (s *Service) Create(ctx context.Context, cmd CreateSavedPassengerCommand) (domain.SavedPassenger, error) {
	id, err := s.ids.NewID()
	if err != nil {
		return domain.SavedPassenger{}, fmt.Errorf("generate passenger ID: %w", err)
	}
	passenger, err := domain.NewSavedPassenger(
		id,
		cmd.OwnerID,
		cmd.FullName,
		s.clock.Now(),
	)
	if err != nil {
		return domain.SavedPassenger{}, err
	}
	if err := s.repository.Create(ctx, passenger); err != nil {
		return domain.SavedPassenger{}, fmt.Errorf("save passenger: %w", err)
	}
	return passenger, nil
}

func (s *Service) List(ctx context.Context, ownerID string) ([]domain.SavedPassenger, error) {
	result, err := s.repository.ListByOwner(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("list saved passengers: %w", err)
	}
	return result, nil
}

func (s *Service) Rename(
	ctx context.Context,
	ownerID, id, fullName string,
) (domain.SavedPassenger, error) {
	passenger, err := s.repository.FindByIDAndOwner(ctx, id, ownerID)
	if err != nil {
		return domain.SavedPassenger{}, fmt.Errorf("find passenger: %w", err)
	}

	if err := passenger.Rename(fullName); err != nil {
		return domain.SavedPassenger{}, err
	}

	if err := s.repository.Update(ctx, passenger); err != nil {
		return domain.SavedPassenger{}, fmt.Errorf("update passenger full name: %w", err)
	}

	return passenger, nil
}

func (s *Service) Delete(ctx context.Context, ownerID, id string) error {
	if err := s.repository.Delete(ctx, id, ownerID); err != nil {
		return fmt.Errorf("delete saved passenger: %w", err)
	}
	return nil
}
