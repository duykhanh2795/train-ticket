"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import type { TripSearchItem } from "./types";

type Range = [number, number];
type DeparturePeriod = "morning" | "afternoon" | "evening";

const departurePeriods: {
  value: DeparturePeriod;
  label: string;
  hours: string;
}[] = [
  { value: "morning", label: "Morning", hours: "05:00–11:59" },
  { value: "afternoon", label: "Afternoon", hours: "12:00–17:59" },
  { value: "evening", label: "Evening & night", hours: "18:00–04:59" },
];

export interface TripFilterValues {
  departure: Range;
  arrival: Range;
  price: Range;
  periods: DeparturePeriod[];
}

export const DEFAULT_TRIP_FILTERS: TripFilterValues = {
  departure: [0, 1440],
  arrival: [0, 1440],
  price: [0, 100],
  periods: [],
};

function minuteOfDay(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function fareBounds(trips: TripSearchItem[]): Range | null {
  const fares = trips
    .map((trip) => trip.fare_from_vnd)
    .filter((fare): fare is number => fare !== null);
  if (fares.length === 0) return null;
  return [Math.min(...fares), Math.max(...fares)];
}

function fareAt(percent: number, bounds: Range) {
  return bounds[0] + ((bounds[1] - bounds[0]) * percent) / 100;
}

function departurePeriod(minutes: number): DeparturePeriod {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return "morning";
  if (minutes >= 12 * 60 && minutes < 18 * 60) return "afternoon";
  return "evening";
}

export function filterTrips(
  trips: TripSearchItem[],
  filters: TripFilterValues,
): TripSearchItem[] {
  const bounds = fareBounds(trips);
  const priceActive = filters.price[0] > 0 || filters.price[1] < 100;

  return trips.filter((trip) => {
    const departure = minuteOfDay(trip.departure_at);
    const arrival = minuteOfDay(trip.arrival_at);
    if (departure < filters.departure[0] || departure > filters.departure[1])
      return false;
    if (
      filters.periods.length > 0 &&
      !filters.periods.includes(departurePeriod(departure))
    )
      return false;
    if (arrival < filters.arrival[0] || arrival > filters.arrival[1])
      return false;
    if (!priceActive || !bounds || bounds[0] === bounds[1]) return true;
    return (
      trip.fare_from_vnd !== null &&
      trip.fare_from_vnd >= fareAt(filters.price[0], bounds) &&
      trip.fare_from_vnd <= fareAt(filters.price[1], bounds)
    );
  });
}

function timeLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function fareLabel(amount: number) {
  return `${new Intl.NumberFormat("en-US").format(Math.round(amount))} ₫`;
}

function activeFilterCount(filters: TripFilterValues) {
  return (
    Number(filters.departure[0] > 0 || filters.departure[1] < 1440) +
    Number(filters.arrival[0] > 0 || filters.arrival[1] < 1440) +
    Number(filters.price[0] > 0 || filters.price[1] < 100) +
    (filters.periods.length === departurePeriods.length
      ? 0
      : filters.periods.length)
  );
}

export function TripFilters({
  trips,
  value,
  onChange,
  title,
}: {
  trips: TripSearchItem[];
  value: TripFilterValues;
  onChange: (value: TripFilterValues) => void;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TripFilterValues>(value);
  const bounds = fareBounds(trips);
  const resultCount = filterTrips(trips, draft).length;
  const activeCount = activeFilterCount(value);

  function updateRange(
    key: keyof TripFilterValues,
    next: number | readonly number[],
  ) {
    if (!Array.isArray(next) || next.length !== 2) return;
    setDraft((current) => ({ ...current, [key]: [next[0], next[1]] }));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraft(value);
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 px-1 text-xs font-medium sm:text-sm"
            aria-label={`Filter ${title.toLowerCase()}`}
          />
        }
      >
        <SlidersHorizontal className="size-3.5" />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
      >
        <div className="max-h-[min(32rem,calc(100vh-10rem))] overflow-y-auto px-5 py-1">
          <div className="border-b py-5">
            <p className="text-sm font-semibold">Departure time</p>
            <p className="mb-5 mt-2 text-sm tabular-nums text-muted-foreground">
              {timeLabel(draft.departure[0])} – {timeLabel(draft.departure[1])}
            </p>
            <Slider
              aria-label="Departure time range"
              min={0}
              max={1440}
              step={15}
              value={draft.departure}
              onValueChange={(next) => updateRange("departure", next)}
            />
          </div>
          <div className="border-b py-5">
            <p className="text-sm font-semibold">Arrival time</p>
            <p className="mb-5 mt-2 text-sm tabular-nums text-muted-foreground">
              {timeLabel(draft.arrival[0])} – {timeLabel(draft.arrival[1])}
            </p>
            <Slider
              aria-label="Arrival time range"
              min={0}
              max={1440}
              step={15}
              value={draft.arrival}
              onValueChange={(next) => updateRange("arrival", next)}
            />
          </div>
          <div className="border-b py-5">
            <p className="text-sm font-semibold">Price</p>
            <p className="mb-5 mt-2 text-sm tabular-nums text-muted-foreground">
              {bounds
                ? `${fareLabel(fareAt(draft.price[0], bounds))} – ${fareLabel(fareAt(draft.price[1], bounds))}`
                : "No fares available"}
            </p>
            <Slider
              aria-label="Price range"
              min={0}
              max={100}
              step={1}
              value={draft.price}
              onValueChange={(next) => updateRange("price", next)}
              disabled={!bounds || bounds[0] === bounds[1]}
            />
          </div>
          <div className="py-5">
            <p className="text-sm font-semibold">Departure periods</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose one or more.
            </p>
            <div className="mt-4 space-y-3">
              {departurePeriods.map((period) => {
                const id = `${title.toLowerCase().replaceAll(" ", "-")}-${period.value}`;
                return (
                  <div
                    key={period.value}
                    className="flex items-center justify-between gap-3"
                  >
                    <label
                      htmlFor={id}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {period.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {period.hours}
                      </span>
                    </label>
                    <Checkbox
                      id={id}
                      checked={draft.periods.includes(period.value)}
                      onCheckedChange={(checked) =>
                        setDraft((current) => ({
                          ...current,
                          periods: checked
                            ? [...current.periods, period.value]
                            : current.periods.filter(
                                (value) => value !== period.value,
                              ),
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft(DEFAULT_TRIP_FILTERS)}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Show results ({resultCount})
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
