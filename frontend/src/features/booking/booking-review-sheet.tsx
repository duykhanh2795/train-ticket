"use client";

import { format } from "date-fns";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TripSearchItem } from "@/features/trip-search/types";
import type { SeatItem } from "./types";

const seatTypeLabels: Record<SeatItem["seat_type"], string> = {
  standard: "Standard",
  sleeper: "Sleeper",
  vip: "VIP",
};

function fareLabel(amount: number | null) {
  return amount == null
    ? "Fare unavailable"
    : `${new Intl.NumberFormat("en-US").format(amount)} ₫`;
}

export function BookingReviewSheet({
  open,
  onOpenChange,
  trip,
  from,
  to,
  seats,
  passengerNames,
  estimatedFare,
  canConfirm,
  onConfirm,
  pending,
  error,
  previewOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripSearchItem;
  from: string;
  to: string;
  seats: SeatItem[];
  passengerNames: string[];
  estimatedFare: number | null;
  canConfirm: boolean;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
  previewOnly?: boolean;
}) {
  const classes = Array.from(new Set(seats.map((seat) => seat.seat_type))).map(
    (type) => {
      const classSeats = seats.filter((seat) => seat.seat_type === type);
      return {
        type,
        count: classSeats.length,
        fromFare: Math.min(
          ...classSeats.map((seat) => seat.fare_vnd ?? Infinity),
        ),
      };
    },
  );
  const classSummary = classes
    .map((item) => seatTypeLabels[item.type])
    .join(" · ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="shrink-0 border-b px-6 pb-6 pt-7 pr-16 sm:px-8 sm:pr-16">
          <SheetTitle className="text-2xl">Fares &amp; classes</SheetTitle>
          <div className="mt-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded bg-muted px-2 py-1">
              Train {trip.train_number}
            </span>
            <span>One-way journey</span>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            {from}{" "}
            <ArrowRight
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />{" "}
            {to}
          </p>
          <SheetDescription className="mt-2">
            {format(new Date(trip.departure_at), "EEE, d MMM yyyy")} ·{" "}
            {format(new Date(trip.departure_at), "HH:mm")}–
            {format(new Date(trip.arrival_at), "HH:mm")}
          </SheetDescription>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-7 sm:px-8">
          <section aria-label="Selected classes">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight">Class</h3>
              <span className="text-xs text-muted-foreground">
                Based on your seats
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {classes.map((item) => (
                <div
                  key={item.type}
                  className="min-h-32 rounded-lg border border-foreground/60 bg-muted/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold">
                      {seatTypeLabels[item.type]}
                    </h4>
                    <span
                      className="flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                      aria-label="Included in this booking"
                    >
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {Number.isFinite(item.fromFare)
                      ? `From ${fareLabel(item.fromFare)}`
                      : "Fare unavailable"}
                  </p>
                  <p className="mt-5 text-xs text-muted-foreground">
                    {item.count} {item.count === 1 ? "seat" : "seats"} selected
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Ticket type">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight">
                Ticket type
              </h3>
            </div>
            <div className="rounded-lg border border-foreground/60 bg-muted/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-semibold">One-way reservation</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {classSummary}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-semibold tabular-nums">
                  {fareLabel(estimatedFare)}
                </p>
              </div>
              <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Clock3 className="size-4 shrink-0" aria-hidden="true" />{" "}
                  Seats held for 10 minutes
                </p>
                <p className="flex items-center gap-2">
                  <Check className="size-4 shrink-0" aria-hidden="true" />{" "}
                  Payment confirms the booking
                </p>
                <p className="flex items-center gap-2">
                  <Check className="size-4 shrink-0" aria-hidden="true" /> Fare
                  and availability checked on confirmation
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              This journey currently has one booking fare type.
            </p>
          </section>

          <section aria-label="Passenger details">
            <h3 className="mb-3 text-lg font-semibold tracking-tight">
              Passengers &amp; seats
            </h3>
            <div className="divide-y rounded-lg border">
              {seats.map((seat, index) => (
                <div
                  key={seat.seat_id}
                  className="flex justify-between gap-4 p-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {passengerNames[index]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {seatTypeLabels[seat.seat_type]} · Coach{" "}
                      {seat.coach_number}, seat {seat.seat_number}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {fareLabel(seat.fare_vnd)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4 sm:px-8">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {!canConfirm && !error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              A selected seat is no longer available. Close this panel and
              choose another seat.
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {fareLabel(estimatedFare)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {seats.length} {seats.length === 1 ? "seat" : "seats"} ·{" "}
                {classSummary}
              </p>
            </div>
            <Button
              onClick={onConfirm}
              disabled={pending || !canConfirm || estimatedFare == null}
              size="lg"
            >
              {previewOnly
                ? "Continue preview"
                : pending
                  ? "Holding seats..."
                  : "Continue"}
              {!pending && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {previewOnly
              ? "This preview uses sample data and cannot place a hold."
              : "The server recalculates the final fare and checks availability when you confirm."}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
