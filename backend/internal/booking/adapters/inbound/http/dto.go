package http

import "time"

type HoldBookingRequest struct {
	TripID     string                 `json:"trip_id" binding:"required,max=256"`
	SeatID     string                 `json:"seat_id" binding:"omitempty,max=256"`
	Passengers []HoldPassengerRequest `json:"passengers"`
	FromStop   *int                   `json:"from_stop" binding:"required,gte=0"`
	ToStop     *int                   `json:"to_stop" binding:"required,gtfield=FromStop"`
}

type HoldPassengerRequest struct {
	SeatID   string `json:"seat_id"`
	FullName string `json:"full_name"`
}

type HoldBookingResponse struct {
	BookingID string    `json:"booking_id"`
	Status    string    `json:"status"`
	ExpiresAt time.Time `json:"expires_at"`
	FareVND   *int64    `json:"fare_vnd"`
}
