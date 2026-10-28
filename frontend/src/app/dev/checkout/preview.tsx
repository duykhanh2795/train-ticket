"use client";

import { useEffect, useState } from "react";
import { CheckoutReview } from "@/features/booking/checkout-page";
import type { BookingView, SeatItem } from "@/features/booking/types";
import type { TripSearchItem } from "@/features/trip-search/types";

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

const previewSeats: SeatItem[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
].flatMap((coach) =>
  Array.from({ length: 24 }, (_, index) => {
    const number = index + 1;
    const seatType =
      coach === "A" ? "standard" : coach === "B" ? "sleeper" : "vip";
    return {
      seat_id: `preview-${coach}-${number}`,
      coach_number: coach,
      seat_number: String(number).padStart(2, "0"),
      seat_type: seatType,
      available:
        number % 7 !== 0 &&
        !(coach === "A" && number === 12) &&
        !(coach === "B" && number === 4),
      fare_vnd: coach === "A" ? 980_000 : coach === "B" ? 1_420_000 : 1_920_000,
    };
  }),
);

export function CheckoutPreview() {
  const [booking, setBooking] = useState<BookingView | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setBooking({
        booking_id: "PREVIEW-BOOKING",
        status: "held",
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        fare_vnd: 2_400_000,
        trip_id: trip.trip_id,
        created_at: new Date().toISOString(),
        train_number: trip.train_number,
        service_date: trip.service_date,
        coach_number: "A",
        seat_number: "12",
        seat_type: "standard",
        from_stop: 0,
        to_stop: 3,
        origin_station: "Hanoi",
        destination_station: "Saigon",
        seats: [
          {
            seat_id: "preview-seat-1",
            coach_number: "A",
            seat_number: "12",
            seat_type: "standard",
            full_name: "Nguyen Duy Khanh",
          },
          {
            seat_id: "preview-seat-2",
            coach_number: "B",
            seat_number: "04",
            seat_type: "sleeper",
            full_name: "Tran Minh Anh",
          },
        ],
      }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="railway-landing min-h-screen bg-muted/35 text-foreground">
      {booking && (
        <CheckoutReview
          booking={booking}
          user={{
            id: "preview-user",
            full_name: "Nguyen Duy Khanh",
            email: "preview@example.com",
          }}
          trip={trip}
          onPay={() => {}}
          paying={false}
          preview
          previewSeats={previewSeats}
        />
      )}
    </main>
  );
}
