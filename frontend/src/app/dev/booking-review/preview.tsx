"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BookingReviewSheet } from "@/features/booking/booking-review-sheet";
import type { TripSearchItem } from "@/features/trip-search/types";
import type { SeatItem } from "@/features/booking/types";

const trip: TripSearchItem = {
  trip_id: "preview-trip",
  train_number: "SE1",
  service_date: "2026-10-22",
  from_stop: 0,
  to_stop: 3,
  departure_at: "2026-10-22T08:00:00+07:00",
  arrival_at: "2026-10-23T05:00:00+07:00",
  fare_from_vnd: 980_000,
};

const seats: SeatItem[] = [
  {
    seat_id: "preview-seat-1",
    coach_number: "1",
    seat_number: "12",
    seat_type: "standard",
    available: true,
    fare_vnd: 980_000,
  },
  {
    seat_id: "preview-seat-2",
    coach_number: "2",
    seat_number: "04",
    seat_type: "sleeper",
    available: true,
    fare_vnd: 1_420_000,
  },
];

export function BookingReviewPreview() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <main className="railway-landing flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 px-6 text-center text-foreground">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Development preview
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Booking review panel
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Sample journey and fares for reviewing the panel design. No booking
        request is sent.
      </p>
      <Button onClick={() => setOpen(true)}>Open panel</Button>
      <BookingReviewSheet
        open={open}
        onOpenChange={setOpen}
        trip={trip}
        from="Hanoi"
        to="Saigon"
        seats={seats}
        passengerNames={["Nguyen Duy Khanh", "Tran Minh Anh"]}
        estimatedFare={2_400_000}
        canConfirm
        pending={false}
        onConfirm={() => router.push("/dev/checkout")}
        previewOnly
      />
    </main>
  );
}
