package domain

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

var ErrInvalidCatalog = errors.New("invalid catalog data")
var ErrConflict = errors.New("catalog entry already exists")

var codePattern = regexp.MustCompile(`^[A-Z0-9]{2,12}$`)
var coachPattern = regexp.MustCompile(`^[A-Z0-9]{1,12}$`)

type Station struct {
	Code string `json:"code"`
	Name string `json:"name"`
	City string `json:"city"`
}

func (s Station) Validate() error {
	if !codePattern.MatchString(s.Code) || strings.TrimSpace(s.Name) == "" || strings.TrimSpace(s.City) == "" || len(s.Name) > 120 || len(s.City) > 120 {
		return ErrInvalidCatalog
	}
	return nil
}

type Stop struct {
	StationID   string     `json:"station_id"`
	ArrivalAt   *time.Time `json:"arrival_at"`
	DepartureAt *time.Time `json:"departure_at"`
}

type SeatGroup struct {
	CoachNumber string `json:"coach_number"`
	SeatType    string `json:"seat_type"`
	SeatCount   int    `json:"seat_count"`
}

type Fare struct {
	FromStop  int    `json:"from_stop"`
	SeatType  string `json:"seat_type"`
	AmountVND int64  `json:"amount_vnd"`
}

type Trip struct {
	ID          string      `json:"id"`
	TrainNumber string      `json:"train_number"`
	ServiceDate time.Time   `json:"-"`
	Stops       []Stop      `json:"stops"`
	SeatGroups  []SeatGroup `json:"seat_groups"`
	Fares       []Fare      `json:"fares"`
}

func (t Trip) Validate(now time.Time) error {
	if strings.TrimSpace(t.TrainNumber) == "" || len(t.TrainNumber) > 20 || len(t.Stops) < 2 || len(t.Stops) > 50 || len(t.SeatGroups) == 0 || len(t.SeatGroups) > 30 {
		return ErrInvalidCatalog
	}
	stationIDs := map[string]bool{}
	var previous time.Time
	for i, stop := range t.Stops {
		if !codePattern.MatchString(stop.StationID) || stationIDs[stop.StationID] || (i == 0 && stop.ArrivalAt != nil) || (i == len(t.Stops)-1 && stop.DepartureAt != nil) || (i > 0 && stop.ArrivalAt == nil) || (i < len(t.Stops)-1 && stop.DepartureAt == nil) {
			return fmt.Errorf("stop %d: %w", i, ErrInvalidCatalog)
		}
		stationIDs[stop.StationID] = true
		if stop.ArrivalAt != nil {
			if !previous.IsZero() && !stop.ArrivalAt.After(previous) {
				return ErrInvalidCatalog
			}
			previous = *stop.ArrivalAt
		}
		if stop.DepartureAt != nil {
			if !stop.DepartureAt.After(previous) || (i == 0 && !sameVietnamDate(*stop.DepartureAt, t.ServiceDate)) {
				return ErrInvalidCatalog
			}
			previous = *stop.DepartureAt
		}
	}
	if t.Stops[0].DepartureAt.Before(now) {
		return ErrInvalidCatalog
	}
	coaches := map[string]bool{}
	types := map[string]bool{}
	seats := 0
	for _, group := range t.SeatGroups {
		if !coachPattern.MatchString(group.CoachNumber) || coaches[group.CoachNumber] || !validSeatType(group.SeatType) || group.SeatCount < 1 || group.SeatCount > 120 {
			return ErrInvalidCatalog
		}
		coaches[group.CoachNumber] = true
		types[group.SeatType] = true
		seats += group.SeatCount
	}
	if seats > 2000 || len(t.Fares) != (len(t.Stops)-1)*len(types) {
		return ErrInvalidCatalog
	}
	fareKeys := map[string]bool{}
	for _, fare := range t.Fares {
		key := fmt.Sprintf("%d:%s", fare.FromStop, fare.SeatType)
		if fare.FromStop < 0 || fare.FromStop >= len(t.Stops)-1 || !types[fare.SeatType] || fare.AmountVND <= 0 || fareKeys[key] {
			return ErrInvalidCatalog
		}
		fareKeys[key] = true
	}
	return nil
}

func validSeatType(t string) bool { return t == "standard" || t == "sleeper" || t == "vip" }

func sameVietnamDate(instant, date time.Time) bool {
	ict := time.FixedZone("ICT", 7*60*60)
	y, m, d := instant.In(ict).Date()
	dy, dm, dd := date.Date()
	return y == dy && m == dm && d == dd
}
