import { apiClient } from "@/shared/api/client";
import type { TripSearchQuery, TripSearchResponse } from "./types";

export async function searchTrips(
  query: TripSearchQuery,
): Promise<TripSearchResponse> {
  const response = await apiClient.get<TripSearchResponse>("/trips", {
    params: {
      origin_id: query.originId,
      destination_id: query.destinationId,
      service_date: query.serviceDate,
    },
  });
  return response.data;
}
