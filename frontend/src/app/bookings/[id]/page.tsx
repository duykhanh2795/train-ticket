import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingDetailsPage } from "@/features/booking/bookings-page";

export const metadata: Metadata = { title: "Booking details | Railway" };

export default function Page({ params }: PageProps<"/bookings/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <BookingDetails params={params} />
    </Suspense>
  );
}

async function BookingDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetailsPage id={id} />;
}
