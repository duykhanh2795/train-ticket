"use client";

import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
} from "date-fns";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ChevronUp,
  Clock3,
  ThumbsUp,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookingStore } from "@/features/booking/store";
import { cn } from "@/lib/utils";
import { searchTrips } from "./api";
import { demoTrips } from "./demo-trips";
import { DepartureDateTimeField } from "./departure-date-time-field";
import { STATIONS, stationName } from "./stations";
import {
  DEFAULT_TRIP_FILTERS,
  filterTrips,
  TripFilters,
  type TripFilterValues,
} from "./trip-filters";
import type { TripSearchItem, TripSearchQuery } from "./types";

const operatorLogos: Record<string, string> = {
  "Heathrow Express": "/images/brand/0AS07120009ymv45t807C.avif",
  CrossCountry: "/images/brand/0AS0v120009ymv9j152E2.avif",
  "Gatwick Express": "/images/brand/0AS1w120009ymv4qiCA55.avif",
  "Grand Central": "/images/brand/0AS2c120009ymvfpz9EAE.avif",
  ScotRail: "/images/brand/0AS38120009ymvhrw11DA.avif",
  "East Midlands Railway": "/images/brand/0AS3e120009ymv673A324.avif",
  c2c: "/images/brand/0AS43120009ymvgom6E6F.avif",
  "Avanti West Coast": "/images/brand/0AS44120009ymvhrxA3ED.avif",
  "TransPennine Express": "/images/brand/0AS4m120009ymv45q1F64.avif",
  "West Midlands Railway": "/images/brand/0AS6t120009ymv2zsFEB8.avif",
  "Chiltern Railways": "/images/brand/1ny0n12000tnbwcvg2F78.avif",
};
import { tripSearchHref } from "./url";

type SortOrder = "earliest" | "latest" | "lowest" | "shortest";

const sortLabels: Record<SortOrder, string> = {
  earliest: "Departure: earliest",
  latest: "Departure: latest",
  lowest: "Lowest fare",
  shortest: "Shortest journey",
};

function fareLabel(amount: number | null) {
  return amount == null
    ? "Fare unavailable"
    : `${new Intl.NumberFormat("en-US").format(amount)} ₫`;
}

function durationMinutes(trip: TripSearchItem) {
  return differenceInMinutes(
    new Date(trip.arrival_at),
    new Date(trip.departure_at),
  );
}

function durationLabel(trip: TripSearchItem) {
  const minutes = durationMinutes(trip);
  if (minutes < 0) return "Duration unavailable";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function arrivalDayLabel(trip: TripSearchItem) {
  const days = differenceInCalendarDays(
    new Date(trip.arrival_at),
    new Date(trip.departure_at),
  );
  return days > 0 ? `+${days} day${days === 1 ? "" : "s"}` : "";
}

type TripHighlight = "recommended" | "fastest" | "cheapest";

function tripHighlights(trips: TripSearchItem[]) {
  const highlights = new Map<string, TripHighlight>();
  if (trips.length < 2) return highlights;
  const priced = trips.filter((trip) => trip.fare_from_vnd != null);
  const cheapest = [...priced].sort(
    (a, b) => (a.fare_from_vnd ?? 0) - (b.fare_from_vnd ?? 0),
  )[0];
  const fastest = [...trips].sort(
    (a, b) => durationMinutes(a) - durationMinutes(b),
  )[0];
  if (cheapest) highlights.set(cheapest.trip_id, "cheapest");
  if (fastest && !highlights.has(fastest.trip_id)) {
    highlights.set(fastest.trip_id, "fastest");
  }
  const candidates = priced.filter((trip) => !highlights.has(trip.trip_id));
  if (candidates.length && priced.length >= 3) {
    const fares = priced.map((trip) => trip.fare_from_vnd ?? 0);
    const durations = priced.map(durationMinutes);
    const minFare = Math.min(...fares);
    const fareRange = Math.max(...fares) - minFare || 1;
    const minDuration = Math.min(...durations);
    const durationRange = Math.max(...durations) - minDuration || 1;
    const recommended = [...candidates].sort((a, b) => {
      const score = (trip: TripSearchItem) =>
        ((trip.fare_from_vnd ?? 0) - minFare) / fareRange +
        (durationMinutes(trip) - minDuration) / durationRange;
      return score(a) - score(b);
    })[0];
    highlights.set(recommended.trip_id, "recommended");
  }
  return highlights;
}

export function TrainSearchResults({
  query,
  departAfter,
  passengerCount,
}: {
  query: TripSearchQuery | null;
  departAfter: string;
  passengerCount: number;
}) {
  const router = useRouter();
  const setSearch = useBookingStore((state) => state.setSearch);
  const chooseTrip = useBookingStore((state) => state.chooseTrip);
  const [originId, setOriginId] = useState(query?.originId ?? "HN");
  const [destinationId, setDestinationId] = useState(
    query?.destinationId ?? "SG",
  );
  const [serviceDate, setServiceDate] = useState(query?.serviceDate ?? "");
  const [departureTime, setDepartureTime] = useState(departAfter);
  const [today, setToday] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [firstFilters, setFirstFilters] =
    useState<TripFilterValues>(DEFAULT_TRIP_FILTERS);
  const [secondFilters, setSecondFilters] =
    useState<TripFilterValues>(DEFAULT_TRIP_FILTERS);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setToday(format(new Date(), "yyyy-MM-dd"));
      if (!serviceDate)
        setServiceDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [serviceDate]);

  const tripsQuery = useQuery({
    queryKey: ["trips", query],
    queryFn: () => searchTrips(query!),
    enabled: query !== null,
    retry: false,
  });
  const liveTrips = tripsQuery.data?.trips ?? [];
  const showingDemo =
    query !== null &&
    (tripsQuery.isError || (tripsQuery.isSuccess && liveTrips.length === 0));
  const trips = showingDemo ? demoTrips(query) : liveTrips;
  const visibleTrips = trips
    .filter(
      (trip) => format(new Date(trip.departure_at), "HH:mm") >= departAfter,
    )
    .sort(
      (a, b) =>
        new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime(),
    );
  const firstColumn = visibleTrips.slice(0, Math.ceil(visibleTrips.length / 2));
  const secondColumn = visibleTrips.slice(firstColumn.length);
  const filteredTrips = [
    ...filterTrips(firstColumn, firstFilters),
    ...filterTrips(secondColumn, secondFilters),
  ];
  const highlights = tripHighlights(filteredTrips);
  const selectedTrip =
    filteredTrips.find((trip) => trip.trip_id === selectedTripId) ??
    filteredTrips[0] ??
    null;
  const from = stationName(query?.originId ?? originId);
  const to = stationName(query?.destinationId ?? destinationId);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (originId === destinationId) {
      setFormError("Choose two different stations.");
      return;
    }
    if (!serviceDate || (today && serviceDate < today)) {
      setFormError("Choose a valid departure date.");
      return;
    }
    setFormError("");
    router.push(
      tripSearchHref(
        { originId, destinationId, serviceDate },
        { departAfter: departureTime, passengers: passengerCount },
      ),
    );
  }

  function chooseSeats() {
    if (
      !query ||
      !selectedTrip ||
      showingDemo ||
      selectedTrip.trip_id.startsWith("demo-")
    )
      return;
    setSearch(query);
    chooseTrip(selectedTrip);
    router.push(`/booking?pax=${passengerCount}#booking-flow`);
  }

  function showEarlierTrains() {
    if (!query || !today || query.serviceDate <= today) return;
    const previousDate = format(
      addDays(new Date(`${query.serviceDate}T12:00:00`), -1),
      "yyyy-MM-dd",
    );
    router.push(
      tripSearchHref({ ...query, serviceDate: previousDate }, { departAfter, passengers: passengerCount }),
    );
  }

  return (
    <div className="railway-landing min-h-screen bg-[#F2F1F0] text-foreground dark:bg-muted/40">
      <section className="bg-background">
        <div className="mx-auto max-w-315 px-5 pb-6 pt-5 md:px-8">
          <h1 className="sr-only">
            Train tickets from {from} to {to}
          </h1>
          <div className="mb-4 flex items-center gap-9 text-base font-medium sm:gap-10">
            <span className="border-b-2 border-[#3267F6] pb-3 font-semibold text-[#3267F6] dark:border-[#8FB0FF] dark:text-[#8FB0FF]">
              Single
            </span>
            <span
              className="pb-3 text-muted-foreground/60"
              title="Return trips are not available yet"
            >
              Return
            </span>
            <span
              className="pb-3 text-muted-foreground/60"
              title="Open returns are not available yet"
            >
              Open return
            </span>
          </div>
          <form
            onSubmit={submitSearch}
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] lg:items-end"
          >
            <div className="relative rounded-md bg-[#F0F3F7] px-3 py-2 dark:bg-muted">
              <Label
                htmlFor="results-origin"
                className="text-xs text-muted-foreground"
              >
                From
              </Label>
              <Select
                value={originId}
                onValueChange={(value) => value && setOriginId(value)}
              >
                <SelectTrigger
                  id="results-origin"
                  className="mt-0.5 w-full border-0 bg-transparent px-0 text-sm font-semibold shadow-none"
                >
                  <SelectValue>{stationName(originId)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="railway-landing">
                  {STATIONS.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="absolute -right-5 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-card sm:inline-flex"
                aria-label="Swap stations"
                onClick={() => {
                  setOriginId(destinationId);
                  setDestinationId(originId);
                }}
              >
                <ArrowLeftRight className="size-3.5" />
              </Button>
            </div>
            <div className="rounded-md bg-[#F0F3F7] px-3 py-2 dark:bg-muted">
              <Label
                htmlFor="results-destination"
                className="text-xs text-muted-foreground"
              >
                To
              </Label>
              <Select
                value={destinationId}
                onValueChange={(value) => value && setDestinationId(value)}
              >
                <SelectTrigger
                  id="results-destination"
                  className="mt-0.5 w-full border-0 bg-transparent px-0 text-sm font-semibold shadow-none"
                >
                  <SelectValue>{stationName(destinationId)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="railway-landing">
                  {STATIONS.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DepartureDateTimeField
              date={serviceDate}
              time={departureTime}
              minDate={today}
              onDateChange={setServiceDate}
              onTimeChange={setDepartureTime}
            />
            <div className="min-w-0 rounded-md bg-[#F0F3F7] px-3 py-2 dark:bg-muted">
              <p className="text-xs text-muted-foreground">
                Return · coming soon
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled
                  className="min-w-0 flex-1 justify-start gap-2 px-1"
                >
                  <CalendarDays className="size-4 shrink-0" />
                  Choose date
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled
                  className="shrink-0 gap-1.5 px-1 tabular-nums"
                >
                  --:--
                  <Clock3 className="size-3.5" />
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="h-14 px-6 sm:col-span-2 lg:col-span-1"
            >
              Search
            </Button>
          </form>
          {formError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>
      </section>

      <main className="mx-auto grid max-w-[1260px] gap-4 px-5 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
        <div className="min-w-0 xl:col-span-2">
          {!query && (
            <Alert className="mb-4 bg-card">
              <AlertTitle>Start with a route</AlertTitle>
              <AlertDescription>
                Choose two stations and a departure date above.
              </AlertDescription>
            </Alert>
          )}
          {showingDemo && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                {tripsQuery.isError
                  ? "Live results are unavailable."
                  : "No live trains were found for this date."}{" "}
                Showing example departures with sample operator logos; these
                cannot be booked.
              </span>
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
                onClick={() => tripsQuery.refetch()}
              >
                Retry live search
              </button>
            </div>
          )}
          {trips.length > 0 && visibleTrips.length === 0 && (
            <Alert className="mb-4 bg-card">
              <AlertTitle>No trains after {departAfter}</AlertTitle>
              <AlertDescription>
                Choose an earlier departure time to see more trains.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2 md:gap-0 md:[&>section:first-child]:rounded-r-none md:[&>section:last-child]:rounded-l-none md:[&>section:last-child]:border-l-0">
            <TrainColumn
              title="Earlier departures"
              date={query?.serviceDate}
              trips={firstColumn}
              filters={firstFilters}
              onFiltersChange={setFirstFilters}
              selectedTripId={selectedTrip?.trip_id ?? null}
              demo={showingDemo}
              highlights={highlights}
              loading={tripsQuery.isPending && !!query}
              from={from}
              to={to}
              onSelect={setSelectedTripId}
              onEarlier={showEarlierTrains}
              canShowEarlier={!!query && !!today && query.serviceDate > today}
            />
            <TrainColumn
              title="Later departures"
              date={query?.serviceDate}
              trips={secondColumn}
              filters={secondFilters}
              onFiltersChange={setSecondFilters}
              selectedTripId={selectedTrip?.trip_id ?? null}
              demo={showingDemo}
              highlights={highlights}
              loading={tripsQuery.isPending && !!query}
              from={from}
              to={to}
              onSelect={setSelectedTripId}
              onEarlier={showEarlierTrains}
              canShowEarlier={!!query && !!today && query.serviceDate > today}
            />
          </div>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card className="gap-0 rounded-xl bg-card py-0 shadow-none">
            <CardContent className="p-0">
              <div className="border-b p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  {showingDemo ? "Example fare from" : "One-way fare from"}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {selectedTrip ? fareLabel(selectedTrip.fare_from_vnd) : "—"}
                </p>
                <Button
                  className="mt-5 w-full"
                  onClick={chooseSeats}
                  disabled={!selectedTrip || showingDemo}
                >
                  {showingDemo ? "Demo · Booking unavailable" : "Choose seats"}
                </Button>
                {showingDemo && (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Select a live train to reserve a seat.
                  </p>
                )}
              </div>
              <div className="p-5">
                {selectedTrip ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className="flex size-6 items-center justify-center rounded-md bg-muted"
                        aria-hidden="true"
                      >
                        <ArrowRight className="size-3.5" />
                      </span>
                      {format(
                        new Date(selectedTrip.departure_at),
                        "EEE, MMM d, yyyy",
                      )}
                    </div>
                    <div className="relative mt-4 space-y-4 pl-8 text-sm before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
                      <p className="relative">
                        <span className="absolute -left-8 top-1.5 size-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                        <strong className="mr-2 tabular-nums">
                          {format(new Date(selectedTrip.departure_at), "HH:mm")}
                        </strong>
                        {from}
                      </p>
                      <p className="relative">
                        <span className="absolute -left-8 top-1.5 size-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                        <strong className="mr-2 tabular-nums">
                          {format(new Date(selectedTrip.arrival_at), "HH:mm")}
                        </strong>
                        {to}
                        {arrivalDayLabel(selectedTrip) && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {arrivalDayLabel(selectedTrip)}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="mt-4 pl-8 text-xs text-muted-foreground">
                      {durationLabel(selectedTrip)} · Direct · Train{" "}
                      {selectedTrip.train_number}
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Select a train to review the journey here.
                  </p>
                )}
                <div className="mt-5 border-t pt-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <span
                      className="flex size-6 items-center justify-center rounded-md bg-muted"
                      aria-hidden="true"
                    >
                      <ArrowLeft className="size-3.5" />
                    </span>
                    Return journey
                  </div>
                  <p className="mt-3 pl-8 text-xs text-muted-foreground">
                    Return booking is not available yet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function TrainColumn({
  title,
  date,
  trips,
  filters,
  onFiltersChange,
  selectedTripId,
  demo,
  highlights,
  loading,
  from,
  to,
  onSelect,
  onEarlier,
  canShowEarlier,
}: {
  title: string;
  date?: string;
  trips: TripSearchItem[];
  filters: TripFilterValues;
  onFiltersChange: (filters: TripFilterValues) => void;
  selectedTripId: string | null;
  demo: boolean;
  highlights: Map<string, TripHighlight>;
  loading: boolean;
  from: string;
  to: string;
  onSelect: (tripID: string) => void;
  onEarlier: () => void;
  canShowEarlier: boolean;
}) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("earliest");
  const filteredTrips = filterTrips(trips, filters).sort((a, b) => {
    if (sortOrder === "lowest")
      return (a.fare_from_vnd ?? Infinity) - (b.fare_from_vnd ?? Infinity);
    if (sortOrder === "shortest")
      return durationMinutes(a) - durationMinutes(b);
    const difference =
      new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime();
    return sortOrder === "latest" ? -difference : difference;
  });

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
      aria-label={title}
    >
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"
          aria-hidden="true"
        >
          <ArrowRight className="size-3.5" />
        </span>
        <div>
          <p className="text-[11px] leading-4 text-muted-foreground">{title}</p>
          <h3 className="text-sm font-semibold">
            {date
              ? format(new Date(`${date}T12:00:00`), "EEE, MMM d, yyyy")
              : "Choose a date"}
          </h3>
        </div>
      </div>
      <div className="flex h-14 items-center justify-between gap-2 border-b px-3 sm:px-5">
        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <SelectTrigger
            className="h-8 min-w-0 border-0 bg-transparent px-0 text-xs shadow-none sm:text-sm"
            aria-label={`Sort ${title.toLowerCase()}`}
          >
            <span>
              Sort by: <strong>{sortLabels[sortOrder]}</strong>
            </span>
          </SelectTrigger>
          <SelectContent className="railway-landing">
            {(Object.keys(sortLabels) as SortOrder[]).map((value) => (
              <SelectItem key={value} value={value}>
                {sortLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TripFilters
          trips={trips}
          value={filters}
          onChange={onFiltersChange}
          title={title}
        />
      </div>
      <div className="flex h-12 items-center justify-center border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEarlier}
          disabled={!canShowEarlier}
          title={
            canShowEarlier
              ? "Search the previous day"
              : "No earlier date available"
          }
        >
          Earlier trains <ChevronUp className="size-3.5" />
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          {trips.length === 0
            ? "No departures to show."
            : "No trains match this filter."}
        </p>
      ) : (
        filteredTrips.map((trip) => (
          <button
            key={trip.trip_id}
            type="button"
            aria-pressed={selectedTripId === trip.trip_id}
            onClick={() => onSelect(trip.trip_id)}
            className={cn(
              "w-full border-b border-l-4 border-l-transparent px-5 py-5 text-left transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              selectedTripId === trip.trip_id &&
                "border-l-[#3267F6] bg-[#EEF3FF] shadow-[inset_0_0_0_1px_#3267F6] hover:bg-[#EEF3FF] dark:border-l-[#8FB0FF] dark:bg-[#1B2B4A] dark:shadow-[inset_0_0_0_1px_#8FB0FF] dark:hover:bg-[#1B2B4A]",
            )}
          >
            <div className="flex min-h-6 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                {trip.operator_name && operatorLogos[trip.operator_name] ? (
                  <Image
                    src={operatorLogos[trip.operator_name]}
                    alt={trip.operator_name}
                    width={100}
                    height={24}
                    className="h-6 w-auto max-w-28 rounded-sm bg-white px-1 object-contain"
                  />
                ) : trip.operator_name ? (
                  <span className="font-semibold tracking-tight text-foreground">
                    {trip.operator_name}
                  </span>
                ) : null}
                <span className={cn(trip.operator_name && "border-l pl-2")}>
                  Train {trip.train_number}
                </span>
              </div>
              {highlights.get(trip.trip_id) === "recommended" ? (
                <Badge className="shrink-0 gap-1 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <ThumbsUp className="size-3" /> Recommended
                </Badge>
              ) : highlights.get(trip.trip_id) === "fastest" ? (
                <Badge className="shrink-0 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  Fastest
                </Badge>
              ) : highlights.get(trip.trip_id) === "cheapest" ? (
                <Badge className="shrink-0 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Cheapest
                </Badge>
              ) : trip.seats_left != null &&
                trip.seats_left > 0 &&
                trip.seats_left <= 5 ? (
                <Badge className="shrink-0 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  Only {trip.seats_left} left at this price
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="grid grid-cols-[max-content_1rem_max-content] items-start gap-x-3">
                <div className="min-w-0">
                  <p className="text-[20px] font-bold leading-none tracking-tight tabular-nums">
                    {format(new Date(trip.departure_at), "HH:mm")}
                  </p>
                  <p className="mt-2 max-w-28 text-xs leading-5 text-muted-foreground sm:max-w-32 sm:text-sm">
                    {from}
                  </p>
                </div>
                <span
                  className="pt-0.5 text-sm text-muted-foreground/50"
                  aria-hidden="true"
                >
                  →
                </span>
                <div className="min-w-0">
                  <p className="text-[20px] font-bold leading-none tracking-tight tabular-nums">
                    {format(new Date(trip.arrival_at), "HH:mm")}
                  </p>
                  <p className="mt-2 max-w-28 text-xs leading-5 text-muted-foreground sm:max-w-32 sm:text-sm">
                    {to}
                    {arrivalDayLabel(trip) && (
                      <span className="ml-1 whitespace-nowrap text-xs">
                        {arrivalDayLabel(trip)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[20px] font-bold leading-none tracking-tight tabular-nums">
                  {fareLabel(trip.fare_from_vnd)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {demo ? "Example fare" : "From"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground sm:text-sm">
              <span className="border-b border-current pb-0.5">
                {durationLabel(trip)}, direct
              </span>
            </p>
          </button>
        ))
      )}
    </section>
  );
}
