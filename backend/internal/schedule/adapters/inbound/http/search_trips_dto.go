package http

import "time"

type TripSearchResponse struct {
	Trips []TripSearchItem `json:"trips"`
}

type TripSearchItem struct {
	TripID      string    `json:"trip_id"`
	TrainNumber string    `json:"train_number"`
	ServiceDate string    `json:"service_date"`
	FromStop    int       `json:"from_stop"`
	ToStop      int       `json:"to_stop"`
	DepartureAt time.Time `json:"departure_at"`
	ArrivalAt   time.Time `json:"arrival_at"`
	FareFromVND *int64    `json:"fare_from_vnd"`
}
