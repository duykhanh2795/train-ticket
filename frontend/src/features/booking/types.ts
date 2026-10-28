export interface SeatItem {
  seat_id: string;
  coach_number: string;
  seat_number: string;
  seat_type: "standard" | "sleeper" | "vip";
  available: boolean;
  fare_vnd: number | null;
}

export interface SeatResponse {
  seats: SeatItem[];
}

export interface BookingResponse {
  booking_id: string;
  status: "held" | "confirmed" | "cancelled" | "expired";
  expires_at: string;
  fare_vnd: number | null;
}

export interface BookingView extends BookingResponse {
  trip_id: string;
  created_at: string;
  train_number: string;
  service_date: string;
  coach_number: string;
  seat_number: string;
  seat_type: SeatItem["seat_type"];
  from_stop: number;
  to_stop: number;
  origin_station: string;
  destination_station: string;
  seats: BookingSeat[];
}

export interface BookingSeat {
  seat_id: string;
  coach_number: string;
  seat_number: string;
  seat_type: SeatItem["seat_type"];
  full_name: string;
}

export interface BookingPage {
  bookings: BookingView[];
  has_more: boolean;
  limit: number;
  offset: number;
}

export interface TicketView {
  id: string;
  booking_id: string;
  seat_id: string;
  issued_at: string;
  full_name: string;
  coach_number: string;
  seat_number: string;
}

export interface TicketPage {
  tickets: TicketView[];
}

export interface HoldBookingInput {
  trip_id: string;
  passengers: { seat_id: string; full_name: string }[];
  from_stop: number;
  to_stop: number;
}

export interface PaymentAttempt {
  payment_id: number;
  booking_id: string;
  amount_vnd: number;
  status: "pending" | "failed" | "succeeded" | "paid_unfulfilled";
  expires_at: string;
}

export interface CheckoutResponse extends PaymentAttempt {
  checkout_url: string;
}
