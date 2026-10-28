import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainSearchResults } from "@/features/trip-search/train-search-results";
import { STATIONS } from "@/features/trip-search/stations";
import type { TripSearchQuery } from "@/features/trip-search/types";

export const metadata: Metadata = { title: "Train search | Railway" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function TrainsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <TrainsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TrainsPageContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const originId = params.origin;
  const destinationId = params.destination;
  const serviceDate = params.date;
  const departAfter = params.after;
  const passengers = typeof params.pax === "string" ? Number(params.pax) : 1;
  const passengerCount = Number.isInteger(passengers) && passengers >= 1 && passengers <= 4 ? passengers : 1;
  const validStations =
    typeof originId === "string" &&
    typeof destinationId === "string" &&
    originId !== destinationId &&
    STATIONS.some((station) => station.id === originId) &&
    STATIONS.some((station) => station.id === destinationId);
  const validDate =
    typeof serviceDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) &&
    !Number.isNaN(new Date(`${serviceDate}T12:00:00Z`).getTime()) &&
    new Date(`${serviceDate}T12:00:00Z`).toISOString().slice(0, 10) ===
      serviceDate;
  const query: TripSearchQuery | null =
    validStations && validDate
      ? { originId, destinationId, serviceDate }
      : null;

  return (
    <TrainSearchResults
      key={query ? JSON.stringify({ query, departAfter, passengerCount }) : "invalid"}
      query={query}
      passengerCount={passengerCount}
      departAfter={
        typeof departAfter === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(departAfter)
          ? departAfter
          : "00:00"
      }
    />
  );
}
