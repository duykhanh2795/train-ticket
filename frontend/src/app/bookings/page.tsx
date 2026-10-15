import type { Metadata } from "next";
import { BookingsPage } from "@/features/booking/bookings-page";

export const metadata: Metadata = { title: "Đặt chỗ của tôi | Railway" };

export default function Page() {
  return <BookingsPage />;
}
