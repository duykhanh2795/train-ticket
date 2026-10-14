import { create } from "zustand";
import type {
  TripSearchItem,
  TripSearchQuery,
} from "@/features/trip-search/types";
import type { BookingResponse, SeatItem } from "./types";

interface BookingState {
  search: TripSearchQuery | null;
  trip: TripSearchItem | null;
  seat: SeatItem | null;
  booking: BookingResponse | null;
  setSearch: (search: TripSearchQuery) => void;
  chooseTrip: (trip: TripSearchItem) => void;
  chooseSeat: (seat: SeatItem) => void;
  setBooking: (booking: BookingResponse) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  search: null,
  trip: null,
  seat: null,
  booking: null,
  setSearch: (search) => set({ search, trip: null, seat: null, booking: null }),
  chooseTrip: (trip) => set({ trip, seat: null, booking: null }),
  chooseSeat: (seat) => set({ seat }),
  setBooking: (booking) => set({ booking }),
  reset: () => set({ search: null, trip: null, seat: null, booking: null }),
}));
