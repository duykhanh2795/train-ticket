import { create } from "zustand";
import type {
  TripSearchItem,
  TripSearchQuery,
} from "@/features/trip-search/types";
import type { BookingResponse, SeatItem } from "./types";

interface BookingState {
  search: TripSearchQuery | null;
  trip: TripSearchItem | null;
  selectedSeats: SeatItem[];
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
  selectedSeats: [],
  booking: null,
  setSearch: (search) => set({ search, trip: null, selectedSeats: [], booking: null }),
  chooseTrip: (trip) => set({ trip, selectedSeats: [], booking: null }),
  chooseSeat: (seat) => set((state) => ({
    selectedSeats: state.selectedSeats.some((item) => item.seat_id === seat.seat_id)
      ? state.selectedSeats.filter((item) => item.seat_id !== seat.seat_id)
      : state.selectedSeats.length < 6 ? [...state.selectedSeats, seat] : state.selectedSeats,
  })),
  setBooking: (booking) => set({ booking }),
  reset: () => set({ search: null, trip: null, selectedSeats: [], booking: null }),
}));
