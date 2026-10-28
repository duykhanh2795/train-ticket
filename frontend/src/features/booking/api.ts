import { apiClient } from "@/shared/api/client";
import type {
  BookingPage,
  BookingResponse,
  BookingView,
  HoldBookingInput,
  SeatResponse,
  CheckoutResponse,
  PaymentAttempt,
  TicketPage,
} from "./types";

export async function listSeats(
  tripId: string,
  fromStop: number,
  toStop: number,
): Promise<SeatResponse> {
  const response = await apiClient.get<SeatResponse>(
    `/trips/${encodeURIComponent(tripId)}/seats`,
    {
      params: { from_stop: fromStop, to_stop: toStop },
    },
  );
  return response.data;
}

export async function holdBooking(
  input: HoldBookingInput,
): Promise<BookingResponse> {
  const response = await apiClient.post<BookingResponse>(
    "/bookings/holds",
    input,
  );
  return response.data;
}

export async function createCheckout(id: string): Promise<CheckoutResponse> {
  const response = await apiClient.post<CheckoutResponse>(
    `/bookings/${encodeURIComponent(id)}/checkout`,
  );
  return response.data;
}

export async function getPayment(id: string): Promise<PaymentAttempt> {
  const response = await apiClient.get<PaymentAttempt>(
    `/payments/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export async function completeMockPayment(id: string): Promise<PaymentAttempt> {
  const response = await apiClient.post<PaymentAttempt>(
    `/payments/${encodeURIComponent(id)}/mock/complete`,
  );
  return response.data;
}

export async function cancelBooking(id: string): Promise<BookingResponse> {
  const response = await apiClient.post<BookingResponse>(
    `/bookings/${encodeURIComponent(id)}/cancel`,
  );
  return response.data;
}

export async function listBookings(
  limit = 10,
  offset = 0,
): Promise<BookingPage> {
  const response = await apiClient.get<BookingPage>("/bookings", {
    params: { limit, offset },
  });
  return response.data;
}

export async function getBooking(id: string): Promise<BookingView> {
  const response = await apiClient.get<BookingView>(
    `/bookings/${encodeURIComponent(id)}`,
  );
  return response.data;
}

export async function getTickets(id: string): Promise<TicketPage> {
  const response = await apiClient.get<TicketPage>(
    `/bookings/${encodeURIComponent(id)}/tickets`,
  );
  return response.data;
}
