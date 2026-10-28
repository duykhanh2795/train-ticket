import { apiClient } from "@/shared/api/client";

export type GateDecision =
  | "ready"
  | "admitted"
  | "already_used"
  | "trip_unavailable"
  | "too_early"
  | "boarding_closed";

export type GateTicket = {
  ticket_id: string;
  booking_id: string;
  full_name: string;
  train_number: string;
  coach_number: string;
  seat_number: string;
  boarding_station_id: string;
  departure_at: string;
  decision: GateDecision;
  scanned_at?: string;
};

export async function inspectGateTicket(qrCode: string): Promise<GateTicket> {
  const response = await apiClient.post<GateTicket>("/gate/tickets/inspect", {
    qr_code: qrCode,
  });
  return response.data;
}

export async function admitGateTicket(qrCode: string): Promise<GateTicket> {
  const response = await apiClient.post<GateTicket>("/gate/tickets/admit", {
    qr_code: qrCode,
  });
  return response.data;
}
