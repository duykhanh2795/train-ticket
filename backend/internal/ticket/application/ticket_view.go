package application

import "time"

// TicketView contains the details needed to display an issued ticket.
type TicketView struct {
	ID          string
	BookingID   string
	SeatID      string
	IssuedAt    time.Time
	FullName    string
	CoachNumber string
	SeatNumber  string
}
