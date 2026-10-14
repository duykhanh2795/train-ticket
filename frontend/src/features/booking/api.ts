import { apiClient } from "@/shared/api/client";
import type { BookingResponse, HoldBookingInput, SeatResponse } from "./types";

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

export async function confirmBooking(id: string): Promise<BookingResponse> {
  const response = await apiClient.post<BookingResponse>(
    `/bookings/${encodeURIComponent(id)}/confirm`,
  );
  return response.data;
}
