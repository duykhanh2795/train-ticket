import { notFound } from "next/navigation";
import { BookingConfirmation } from "@/features/booking/booking-confirmation";
import type { BookingView } from "@/features/booking/types";

const sampleBooking: BookingView = {
  booking_id: "RW-2849-7193",
  status: "confirmed",
  expires_at: "2026-10-19T05:00:00Z",
  fare_vnd: 2_400_000,
  trip_id: "preview-trip",
  created_at: "2026-10-19T04:50:00Z",
  train_number: "SE1",
  service_date: "2026-10-22",
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
};

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BookingConfirmation booking={sampleBooking} preview />;
}
