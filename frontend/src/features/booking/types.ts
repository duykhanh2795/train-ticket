export interface SeatItem {
  seat_id: string;
  coach_number: string;
  seat_number: string;
  seat_type: "standard" | "sleeper" | "vip";
  available: boolean;
}

export interface SeatResponse {
  seats: SeatItem[];
}

export interface BookingResponse {
  booking_id: string;
  status: "held" | "confirmed" | "cancelled" | "expired";
  expires_at: string;
}

export interface HoldBookingInput {
  trip_id: string;
  seat_id: string;
  from_stop: number;
  to_stop: number;
}
