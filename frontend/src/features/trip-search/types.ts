export interface TripSearchQuery {
  originId: string;
  destinationId: string;
  serviceDate: string;
}

export interface TripSearchItem {
  trip_id: string;
  train_number: string;
  service_date: string;
  from_stop: number;
  to_stop: number;
  departure_at: string;
  arrival_at: string;
}

export interface TripSearchResponse {
  trips: TripSearchItem[];
}
