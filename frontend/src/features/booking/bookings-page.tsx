"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiErrorMessage } from "@/shared/api/client";
import { cancelBooking, createCheckout, getBooking, listBookings } from "./api";
import { BookingConfirmation } from "./booking-confirmation";
import type { BookingView } from "./types";

const PAGE_SIZE = 10;

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function bookingStatus(status: BookingView["status"]) {
  switch (status) {
    case "held":
      return "On hold";
    case "confirmed":
      return "Confirmed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
  }
}

function serviceDate(value: string) {
  return format(new Date(`${value}T12:00:00`), "EEEE, dd/MM/yyyy", {
    locale: enUS,
  });
}

function dateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}

function fareLabel(amount: number | null) {
  return amount == null
    ? "Fare unavailable"
    : `${new Intl.NumberFormat("en-US").format(amount)} ₫`;
}

function BookingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="railway-landing min-h-screen bg-[#F0F3F7] text-foreground dark:bg-background">
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">{children}</div>
    </main>
  );
}

function QueryError({ error }: { error: unknown }) {
  if (isUnauthorized(error)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to view your bookings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your booking history is linked to your account.
          </p>
          <Link href="/login?return=bookings" className={buttonVariants()}>
            Sign in
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not load bookings</AlertTitle>
      <AlertDescription>{apiErrorMessage(error)}</AlertDescription>
    </Alert>
  );
}

export function BookingsPage() {
  const [offset, setOffset] = useState(0);
  const bookings = useQuery({
    queryKey: ["bookings", PAGE_SIZE, offset],
    queryFn: () => listBookings(PAGE_SIZE, offset),
  });

  return (
    <BookingShell>
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground">
          YOUR ACCOUNT
        </p>
        <h1 className="mt-2 text-2xl font-semibold">My bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your seat holds and confirmed journeys.
        </p>
      </div>

      {bookings.isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      )}
      {bookings.isError && <QueryError error={bookings.error} />}
      {bookings.data && bookings.data.bookings.length === 0 && offset === 0 && (
        <Card>
          <CardContent className="flex items-start gap-3">
            <div>
              <p className="font-medium">No bookings yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Search for a train and reserve a seat to see your trip here.
              </p>
              <Link
                href="/#search"
                className={buttonVariants({ className: "mt-4" })}
              >
                Search trains
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
      {bookings.data && bookings.data.bookings.length === 0 && offset > 0 && (
        <p className="text-sm text-muted-foreground">
          No more bookings on this page.
        </p>
      )}
      <div className="space-y-3">
        {bookings.data?.bookings.map((booking) => (
          <Card key={booking.booking_id}>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    Train {booking.train_number}
                  </span>
                  <Badge variant="outline">
                    {bookingStatus(booking.status)}
                  </Badge>
                </div>
                <p className="text-sm">
                  {booking.origin_station} → {booking.destination_station}
                </p>
                <p className="text-xs text-muted-foreground">
                  {serviceDate(booking.service_date)} ·{" "}
                  {booking.seats.length > 1
                    ? `${booking.seats.length} passengers · ${booking.seats.length} seats`
                    : `Coach ${booking.coach_number} · Seat ${booking.seat_number}`}
                </p>
                <p className="text-sm font-medium">
                  {fareLabel(booking.fare_vnd)}
                </p>
              </div>
              <Link
                href={`/bookings/${encodeURIComponent(booking.booking_id)}`}
                className={buttonVariants({ variant: "outline" })}
              >
                View details
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      {bookings.data && (offset > 0 || bookings.data.has_more) && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            <ArrowLeft className="size-4" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {offset / PAGE_SIZE + 1}
          </span>
          <Button
            variant="outline"
            disabled={!bookings.data.has_more}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </BookingShell>
  );
}

export function BookingDetailsPage({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const booking = useQuery({
    queryKey: ["bookings", id],
    queryFn: () => getBooking(id),
  });
  const checkout = useMutation({
    mutationFn: () => createCheckout(id),
    onSuccess: (result) => window.location.assign(result.checkout_url),
  });
  const cancel = useMutation({
    mutationFn: () => cancelBooking(id),
    onSuccess: () => {
      setConfirmCancellation(false);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["seats"] });
    },
  });

  if (booking.data?.status === "confirmed") {
    return <BookingConfirmation booking={booking.data} />;
  }

  return (
    <BookingShell>
      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All bookings
      </Link>
      {booking.isPending && <Skeleton className="h-64 rounded-xl" />}
      {booking.isError &&
        (isUnauthorized(booking.error) ? (
          <QueryError error={booking.error} />
        ) : booking.error instanceof ApiError &&
          booking.error.status === 404 ? (
          <Alert>
            <AlertTitle>Booking not found</AlertTitle>
            <AlertDescription>
              This booking does not belong to your account or no longer exists.
            </AlertDescription>
          </Alert>
        ) : (
          <QueryError error={booking.error} />
        ))}
      {booking.data && (
        <>
          <div>
            <p className="text-xs font-medium tracking-widest text-muted-foreground">
              BOOKING DETAILS
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              {booking.data.origin_station} → {booking.data.destination_station}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Booking reference: {booking.data.booking_id}
            </p>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Train {booking.data.train_number}</CardTitle>
              <Badge variant="outline">
                {bookingStatus(booking.data.status)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow
                label="Departure date"
                value={serviceDate(booking.data.service_date)}
              />
              <DetailRow label="From" value={booking.data.origin_station} />
              <DetailRow label="To" value={booking.data.destination_station} />
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Passengers and seats</p>
                {booking.data.seats.map((seat) => (
                  <div
                    key={seat.seat_id}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <span>
                      {seat.full_name || "Passenger name unavailable"}
                    </span>
                    <span className="text-right text-muted-foreground">
                      Coach {seat.coach_number} · Seat {seat.seat_number} ·{" "}
                      {seat.seat_type}
                    </span>
                  </div>
                ))}
              </div>
              <DetailRow
                label="Total fare"
                value={fareLabel(booking.data.fare_vnd)}
              />
              <DetailRow
                label="Booked at"
                value={dateTime(booking.data.created_at)}
              />
              {booking.data.status === "held" && (
                <DetailRow
                  label="Hold expires"
                  value={dateTime(booking.data.expires_at)}
                />
              )}
            </CardContent>
          </Card>
          {booking.data.status === "held" && (
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <div>
                    <p className="font-medium">
                      Your seats are temporarily held
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Complete payment before the hold expires. Your booking is
                      confirmed only after payment is processed.
                    </p>
                  </div>
                </div>
                {checkout.isError && (
                  <p className="text-sm text-destructive">
                    {apiErrorMessage(checkout.error)}
                  </p>
                )}
                <Button
                  disabled={checkout.isPending || cancel.isPending}
                  onClick={() => checkout.mutate()}
                >
                  {checkout.isPending
                    ? "Opening payment..."
                    : "Continue to payment"}
                </Button>
                <div>
                  {confirmCancellation ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <p className="text-sm">
                        Cancel this hold? The seats will become available
                        immediately.
                      </p>
                      {cancel.isError && (
                        <p className="text-sm text-destructive">
                          {apiErrorMessage(cancel.error)}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          disabled={cancel.isPending || checkout.isPending}
                          onClick={() => cancel.mutate()}
                        >
                          {cancel.isPending
                            ? "Cancelling..."
                            : "Confirm cancellation"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={cancel.isPending}
                          onClick={() => setConfirmCancellation(false)}
                        >
                          Keep booking
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={checkout.isPending}
                      onClick={() => setConfirmCancellation(true)}
                    >
                      Cancel hold
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </BookingShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
