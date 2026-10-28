import type { Metadata } from "next";
import { Suspense } from "react";
import { RailBookingExperience } from "@/features/booking/rail-booking-experience";

export const metadata: Metadata = { title: "Choose seats | Railo" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function BookingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <BookingPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BookingPageContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const count = typeof params.pax === "string" ? Number(params.pax) : 1;
  const passengerCount = Number.isInteger(count) && count >= 1 && count <= 4 ? count : 1;
  return <RailBookingExperience bookingOnly initialPassengerCount={passengerCount} />;
}
