import { STATIONS } from "./stations";
import type { TripSearchItem, TripSearchQuery } from "./types";

// Preview only. These trips must never be submitted to the booking API.
const segmentMinutes = [120, 270, 630, 780];
const segmentFareVND = [90_000, 180_000, 360_000, 420_000];
const departures = [
  "05:40",
  "07:20",
  "09:45",
  "13:10",
  "16:30",
  "19:50",
  "22:15",
];
const durationChanges = [-15, 40, -30, 55, -45, 20, 10];
const fareMultipliers = [0.92, 1, 1.16, 1.08, 1.24, 0.88, 1.32];
const previewOperators = [
  "Heathrow Express",
  "CrossCountry",
  "Gatwick Express",
  "Grand Central",
  "ScotRail",
  "East Midlands Railway",
  "c2c",
  "Avanti West Coast",
  "TransPennine Express",
  "West Midlands Railway",
  "Chiltern Railways",
];

export function demoTrips(query: TripSearchQuery): TripSearchItem[] {
  const originIndex = STATIONS.findIndex(
    (station) => station.id === query.originId,
  );
  const destinationIndex = STATIONS.findIndex(
    (station) => station.id === query.destinationId,
  );
  if (
    originIndex < 0 ||
    destinationIndex < 0 ||
    originIndex === destinationIndex
  )
    return [];

  const fromStop = Math.min(originIndex, destinationIndex);
  const toStop = Math.max(originIndex, destinationIndex);
  const baseMinutes = segmentMinutes
    .slice(fromStop, toStop)
    .reduce((sum, value) => sum + value, 0);
  const baseFare = segmentFareVND
    .slice(fromStop, toStop)
    .reduce((sum, value) => sum + value, 0);
  const trainNumbers =
    originIndex < destinationIndex
      ? ["SE5", "SE7", "SE1", "SE3", "SE9", "SE11", "SE19"]
      : ["SE6", "SE8", "SE2", "SE4", "SE10", "SE12", "SE20"];

  return departures.map((departure, index) => {
    const departureAt = new Date(`${query.serviceDate}T${departure}:00+07:00`);
    const arrivalAt = new Date(
      departureAt.getTime() + (baseMinutes + durationChanges[index]) * 60_000,
    );
    return {
      trip_id: `demo-${query.originId}-${query.destinationId}-${query.serviceDate}-${index}`,
      train_number: trainNumbers[index],
      operator_name:
        previewOperators[
          (index * 7 +
            originIndex * 3 +
            destinationIndex +
            Number(query.serviceDate.slice(-2))) %
            previewOperators.length
        ],
      service_date: query.serviceDate,
      from_stop: fromStop,
      to_stop: toStop,
      departure_at: departureAt.toISOString(),
      arrival_at: arrivalAt.toISOString(),
      fare_from_vnd:
        Math.round((baseFare * fareMultipliers[index]) / 10_000) * 10_000,
      seats_left: index === 3 ? 3 : index === 6 ? 5 : undefined,
    };
  });
}
