"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SeatItem } from "./types";

const seatTypeLabels: Record<SeatItem["seat_type"], string> = {
  standard: "Standard",
  sleeper: "Sleeper",
  vip: "VIP",
};

export function PassengerDetails({
  seats,
  names,
  onNameChange,
  error,
}: {
  seats: SeatItem[];
  names: string[];
  onNameChange: (seat: SeatItem, index: number, name: string) => void;
  error?: string;
}) {
  const complete = names.filter((name) => name.trim().length >= 2).length;

  return (
    <Card id="passenger-details" className="scroll-mt-24 bg-card">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">
              Passenger details
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the full name for each seat. These names will be attached to
              the booking.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
            {complete} of {seats.length} complete
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {seats.map((seat, index) => (
            <div
              key={seat.seat_id}
              className="rounded-lg border bg-background/60 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    Passenger {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seatTypeLabels[seat.seat_type]} · Coach {seat.coach_number}
                    , seat {seat.seat_number}
                  </p>
                </div>
                <span className="shrink-0 rounded-md border bg-card px-2 py-1 text-xs font-medium">
                  {seat.coach_number}-{seat.seat_number}
                </span>
              </div>
              <Label
                htmlFor={`passenger-name-${seat.seat_id}`}
                className="text-xs font-medium"
              >
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`passenger-name-${seat.seat_id}`}
                className="mt-2 bg-card"
                maxLength={120}
                autoComplete={index === 0 ? "name" : "off"}
                placeholder="As shown on the passenger's ID"
                value={names[index] ?? ""}
                onChange={(event) =>
                  onNameChange(seat, index, event.target.value)
                }
                aria-invalid={
                  Boolean(error) && (names[index] ?? "").trim().length < 2
                }
              />
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          One name is required for each seat. You can review all passengers
          before placing the seat hold.
        </p>
      </CardContent>
    </Card>
  );
}
