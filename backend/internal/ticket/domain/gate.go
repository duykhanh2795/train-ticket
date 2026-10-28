package domain

import "time"

// The timetable is the only departure source until live delay data is available.
const (
	BoardingOpensBefore = 2 * time.Hour
	BoardingClosesAfter = 30 * time.Minute
)

type GateDecision string

const (
	GateReady           GateDecision = "ready"
	GateAdmitted        GateDecision = "admitted"
	GateAlreadyUsed     GateDecision = "already_used"
	GateTripUnavailable GateDecision = "trip_unavailable"
	GateTooEarly        GateDecision = "too_early"
	GateClosed          GateDecision = "boarding_closed"
)

func AssessBoarding(bookingStatus, tripStatus string, departureAt, now time.Time, scannedAt *time.Time) GateDecision {
	if scannedAt != nil {
		return GateAlreadyUsed
	}
	if bookingStatus != "confirmed" || tripStatus != "scheduled" || departureAt.IsZero() {
		return GateTripUnavailable
	}
	if now.Before(departureAt.Add(-BoardingOpensBefore)) {
		return GateTooEarly
	}
	if now.After(departureAt.Add(BoardingClosesAfter)) {
		return GateClosed
	}
	return GateReady
}
