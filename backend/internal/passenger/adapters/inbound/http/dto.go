package http

import (
	"time"

	"example.com/train-ticket/internal/passenger/domain"
)

type createPassengerRequest struct {
	FullName string `json:"full_name" binding:"required,max=120"`
}

type renamePassengerRequest struct {
	FullName string `json:"full_name" binding:"required,max=120"`
}

type passengerResponse struct {
	ID        string    `json:"id"`
	FullName  string    `json:"full_name"`
	CreatedAt time.Time `json:"created_at"`
}

func toPassengerResponse(passenger domain.SavedPassenger) passengerResponse {
	return passengerResponse{
		ID:        passenger.ID(),
		FullName:  passenger.FullName(),
		CreatedAt: passenger.CreatedAt(),
	}
}
