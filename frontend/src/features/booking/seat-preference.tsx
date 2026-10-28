"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SeatItem } from "./types";

export type SeatChoice = "assign" | "select";
export type SeatClass = "any" | SeatItem["seat_type"];

const unavailablePreferences = [
  "Quiet coach",
  "Table seat",
  "Power socket",
  "Near toilet",
  "Near luggage rack",
];

export function SeatPreference({
  choice,
  onChoiceChange,
  count,
  onCountChange,
  seatClass,
  onSeatClassChange,
  onSelectSeat,
}: {
  choice: SeatChoice;
  onChoiceChange: (choice: SeatChoice) => void;
  count: number;
  onCountChange: (count: number) => void;
  seatClass: SeatClass;
  onSeatClassChange: (seatClass: SeatClass) => void;
  onSelectSeat?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section
      aria-labelledby="seat-preference-title"
      className="rounded-xl border bg-card p-5 sm:p-6"
    >
      <h2
        id="seat-preference-title"
        className="text-lg font-semibold tracking-tight"
      >
        Seat preference{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </h2>
      <div className="mt-5 space-y-3">
        <div
          className={cn(
            "overflow-hidden rounded-lg border",
            choice === "assign" && "border-foreground/70",
          )}
        >
          <div className="flex items-start justify-between gap-4 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="seat-choice"
                checked={choice === "assign"}
                onChange={() => onChoiceChange("assign")}
                className="mt-1 accent-foreground"
              />
              <span>
                <span className="block text-sm font-semibold">
                  Assign me a seat
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  We&apos;ll suggest available seats for your passengers.
                </span>
              </span>
            </label>
            {choice === "assign" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
              >
                {expanded ? "Hide preferences" : "Add preferences"}
              </Button>
            )}
          </div>
          {choice === "assign" && expanded && (
            <div className="space-y-4 border-t bg-muted/25 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="seat-count" className="text-xs font-medium">
                    Passengers
                  </label>
                  <Select
                    value={String(count)}
                    onValueChange={(value) => onCountChange(Number(value))}
                  >
                    <SelectTrigger
                      id="seat-count"
                      className="h-10 w-full bg-background"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value} {value === 1 ? "passenger" : "passengers"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="seat-class" className="text-xs font-medium">
                    Seat class
                  </label>
                  <Select
                    value={seatClass}
                    onValueChange={(value) =>
                      onSeatClassChange(value as SeatClass)
                    }
                  >
                    <SelectTrigger
                      id="seat-class"
                      className="h-10 w-full bg-background"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">No preference</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="sleeper">Sleeper</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="seat-location"
                    className="text-xs font-medium"
                  >
                    Seat location
                  </label>
                  <Select disabled value="none">
                    <SelectTrigger
                      id="seat-location"
                      className="h-10 w-full bg-background"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        Not available for this train
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="seat-facing" className="text-xs font-medium">
                    Seat facing
                  </label>
                  <Select disabled value="none">
                    <SelectTrigger
                      id="seat-facing"
                      className="h-10 w-full bg-background"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        Not available for this train
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div
                className="flex flex-wrap gap-x-5 gap-y-2"
                aria-label="Unavailable train amenities"
              >
                {unavailablePreferences.map((label) => (
                  <label
                    key={label}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Checkbox disabled />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Location, direction and coach facilities need train layout data
                before they can be requested.
              </p>
            </div>
          )}
        </div>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
            choice === "select" && "border-foreground/70",
          )}
        >
          <input
            type="radio"
            name="seat-choice"
            checked={choice === "select"}
            onChange={() => {
              onChoiceChange("select");
              onSelectSeat?.();
            }}
            className="mt-1 accent-foreground"
          />
          <span>
            <span className="block text-sm font-semibold">
              Select seat (free)
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Choose exact seats from the seat map.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
