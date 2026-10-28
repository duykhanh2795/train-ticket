"use client";

import { Check, Copy, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiErrorMessage } from "@/shared/api/client";
import { getTickets } from "./api";
import type { BookingView } from "./types";

function longDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function money(value: number | null) {
  return value == null
    ? "Fare unavailable"
    : `${new Intl.NumberFormat("en-US").format(value)} ₫`;
}

export function BookingConfirmation({
  booking,
  preview = false,
}: {
  booking: BookingView;
  preview?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const tickets = useQuery({
    queryKey: ["tickets", booking.booking_id],
    queryFn: () => getTickets(booking.booking_id),
    enabled: !preview && booking.status === "confirmed",
    retry: false,
  });

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(booking.booking_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="railway-landing min-h-screen bg-[#F0F3F7] text-zinc-950 dark:bg-[#0c0c0e] dark:text-zinc-50">
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {preview && (
          <p className="mb-6 w-fit rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Design preview · sample booking
          </p>
        )}
        <div className="flex flex-col gap-5 border-b border-zinc-200 pb-10 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-6 flex size-10 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Check className="size-5" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              Booking confirmed
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              You’re all set.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              Your seats are confirmed for {longDate(booking.service_date)}.
              Keep your booking reference handy for your journey.
            </p>
          </div>
          <Link
            href="/bookings"
            className={buttonVariants({
              variant: "outline",
              className:
                "shrink-0 border-zinc-300 bg-transparent dark:border-zinc-700",
            })}
          >
            My bookings <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="mt-9 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="border-0 bg-white py-0 shadow-sm ring-1 ring-zinc-200 dark:bg-[#171719] dark:ring-zinc-800">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                      Your journey
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      Train {booking.train_number}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    Confirmed
                  </Badge>
                </div>
                <p className="mt-9 text-sm text-zinc-500">
                  {longDate(booking.service_date)}
                </p>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] items-center gap-2 sm:gap-5">
                  <div>
                    <p className="text-xs text-zinc-500">From</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                      {booking.origin_station}
                    </p>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-x-0 h-px bg-zinc-300 dark:bg-zinc-700" />
                    <span className="relative flex size-7 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs dark:border-zinc-700 dark:bg-[#171719]">
                      →
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">To</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                      {booking.destination_station}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white py-0 shadow-sm ring-1 ring-zinc-200 dark:bg-[#171719] dark:ring-zinc-800">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Passengers & seats
                  </h2>
                  <span className="text-sm text-zinc-500">
                    {booking.seats.length}{" "}
                    {booking.seats.length === 1 ? "passenger" : "passengers"}
                  </span>
                </div>
                <div className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
                  {booking.seats.map((seat, index) => (
                    <div
                      key={seat.seat_id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="font-medium">
                            {seat.full_name || "Passenger"}
                          </p>
                          <p className="mt-0.5 text-xs capitalize text-zinc-500">
                            {seat.seat_type} seat
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-medium">
                        Coach {seat.coach_number}{" "}
                        <span className="mx-1 text-zinc-300 dark:text-zinc-700">
                          /
                        </span>{" "}
                        Seat {seat.seat_number}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {!preview && (
              <Card className="border-0 bg-white py-0 shadow-sm ring-1 ring-zinc-200 dark:bg-[#171719] dark:ring-zinc-800">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Your tickets
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    One ticket is issued for each passenger and seat.
                  </p>
                  {tickets.isPending && (
                    <p className="mt-5 text-sm text-zinc-500">
                      Loading tickets…
                    </p>
                  )}
                  {tickets.isError && (
                    <Alert variant="destructive" className="mt-5">
                      <AlertTitle>Could not load tickets</AlertTitle>
                      <AlertDescription>
                        {apiErrorMessage(tickets.error)}
                      </AlertDescription>
                    </Alert>
                  )}
                  {tickets.data && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {tickets.data.tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                        >
                          <p className="font-medium">{ticket.full_name}</p>
                          <p className="mt-1 text-sm text-zinc-500">
                            Coach {ticket.coach_number} · Seat{" "}
                            {ticket.seat_number}
                          </p>
                          <div className="mt-4 w-fit rounded-md bg-white p-3">
                            <QRCodeSVG
                              value={`railway:ticket:v1:${ticket.id}`}
                              size={144}
                              level="M"
                              marginSize={0}
                              title={`Ticket reference for ${ticket.full_name}`}
                            />
                          </div>
                          <p className="mt-3 break-all text-xs text-zinc-500">
                            Ticket ID: {ticket.id}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-5 text-xs leading-5 text-zinc-500">
                    Keep your ticket ID with your journey details. Gate scan
                    verification is not connected yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-6">
            <Card className="border-0 bg-white py-0 shadow-sm ring-1 ring-zinc-200 dark:bg-[#171719] dark:ring-zinc-800">
              <CardContent className="p-6">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Booking reference
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="min-w-0 break-all font-mono text-lg font-medium tracking-tight">
                    {booking.booking_id}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyReference}
                    aria-label={
                      copied ? "Reference copied" : "Copy booking reference"
                    }
                    title={copied ? "Copied" : "Copy reference"}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
                <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm text-zinc-500">Total paid</span>
                  <span className="text-xl font-semibold tracking-tight">
                    {money(booking.fare_vnd)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Payment verified · Booking confirmed
                </p>
              </CardContent>
            </Card>
            <div className="px-1">
              <h2 className="text-sm font-semibold">Before you travel</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Check your station and travel date. You can return to this
                booking anytime from your account.
              </p>
              <Link
                href="/bookings"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
              >
                View all bookings <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
