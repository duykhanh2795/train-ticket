"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PassengerDetails } from "@/features/booking/passenger-details";
import type { SeatItem } from "@/features/booking/types";

const seats: SeatItem[] = [
  {
    seat_id: "preview-a12",
    coach_number: "A",
    seat_number: "12",
    seat_type: "standard",
    available: true,
    fare_vnd: 980_000,
  },
  {
    seat_id: "preview-a13",
    coach_number: "A",
    seat_number: "13",
    seat_type: "standard",
    available: true,
    fare_vnd: 980_000,
  },
  {
    seat_id: "preview-b04",
    coach_number: "B",
    seat_number: "04",
    seat_type: "sleeper",
    available: true,
    fare_vnd: 1_420_000,
  },
];

export function PassengerDetailsPreview() {
  const [names, setNames] = useState(["Nguyen Duy Khanh", "", ""]);
  const [error, setError] = useState("");
  const [reviewReady, setReviewReady] = useState(false);
  const complete = names.filter((name) => name.trim().length >= 2).length;

  return (
    <main className="railway-landing min-h-screen bg-[#F0F3F7] text-foreground dark:bg-background">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Design preview · sample passengers
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Add passenger details
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hanoi → Saigon · Train SE1 · 3 seats selected
        </p>
        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div>
            <PassengerDetails
              seats={seats}
              names={names}
              error={error}
              onNameChange={(_, index, name) => {
                setNames((current) =>
                  current.map((value, position) =>
                    position === index ? name : value,
                  ),
                );
                setError("");
                setReviewReady(false);
              }}
            />
          </div>
          <Card className="h-fit bg-card lg:sticky lg:top-8">
            <CardHeader>
              <CardTitle>Booking summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Passengers</span>
                <span className="font-medium">{complete} / 3 complete</span>
              </div>
              <div className="flex justify-between gap-3 border-t pt-4 text-sm">
                <span className="text-muted-foreground">Estimated fare</span>
                <span className="font-semibold">3,380,000 ₫</span>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (complete !== seats.length) {
                    setError(
                      "Enter a full name for each passenger (at least 2 characters).",
                    );
                    return;
                  }
                  setReviewReady(true);
                }}
              >
                Review booking
              </Button>
              {reviewReady && (
                <p className="text-xs text-muted-foreground">
                  Preview complete. No booking was created.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Preview only · no seats are held.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
