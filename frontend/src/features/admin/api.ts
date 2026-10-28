import { apiClient } from "@/shared/api/client";

export type Station = { id: string; code: string; name: string; city: string };
export type AdminTrip = { id: string; train_number: string; service_date: string; status: string; stop_count: number; seat_count: number };
export type AdminBooking = { id: string; trip_id: string; train_number: string; service_date: string; customer_email: string; status: string; created_at: string; fare_vnd: number | null };
export type NewTrip = {
  train_number: string;
  service_date: string;
  stops: { station_id: string; arrival_at: string | null; departure_at: string | null }[];
  seat_groups: { coach_number: string; seat_type: string; seat_count: number }[];
  fares: { from_stop: number; seat_type: string; amount_vnd: number }[];
};

export async function adminAccess(): Promise<boolean> {
  const response = await apiClient.get<{ is_admin: boolean }>("/admin/me");
  return response.data.is_admin;
}

export async function listStations(): Promise<Station[]> {
  const response = await apiClient.get<{ stations: Station[] }>("/admin/stations");
  return response.data.stations;
}

export async function createStation(input: { code: string; name: string; city: string }): Promise<void> {
  await apiClient.post("/admin/stations", input);
}

export async function listTrips(offset: number): Promise<AdminTrip[]> {
  const response = await apiClient.get<{ trips: AdminTrip[] }>("/admin/trips", { params: { limit: 20, offset } });
  return response.data.trips;
}

export async function createTrip(input: NewTrip): Promise<void> {
  await apiClient.post("/admin/trips", input);
}

export async function listBookings(offset: number): Promise<AdminBooking[]> {
  const response = await apiClient.get<{ bookings: AdminBooking[] }>("/admin/bookings", { params: { limit: 20, offset } });
  return response.data.bookings;
}
