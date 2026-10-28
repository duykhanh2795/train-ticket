"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  LockKeyhole,
  TrainFront,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUser } from "@/features/auth/api";
import type { AuthUser } from "@/features/auth/types";
import type { TripSearchItem } from "@/features/trip-search/types";
import { apiErrorMessage } from "@/shared/api/client";
import { createCheckout, getBooking } from "./api";
import { SeatPreference, type SeatChoice, type SeatClass } from "./seat-preference";
import { SeatPickerDialog } from "./seat-picker-dialog";
import { useBookingStore } from "./store";
import type { BookingView, SeatItem } from "./types";

function fareLabel(amount: number | null) {
  return amount == null
    ? "Fare unavailable"
    : `${new Intl.NumberFormat("en-US").format(amount)} ₫`;
}

function seatTypeLabel(type: BookingView["seat_type"]) {
  return { standard: "Standard", sleeper: "Sleeper", vip: "VIP" }[type];
}

export function CheckoutPage({ id }: { id: string }) {
  const trip = useBookingStore((state) => state.trip);
  const booking = useQuery({
    queryKey: ["bookings", id],
    queryFn: () => getBooking(id),
    refetchInterval: 15_000,
  });
  const user = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    retry: false,
  });
  const checkout = useMutation({
    mutationFn: () => createCheckout(id),
    onSuccess: (result) => window.location.assign(result.checkout_url),
  });

  return (
    <main className="railway-landing min-h-screen bg-[#F0F3F7] text-foreground dark:bg-muted/35">
      {booking.isPending ? (
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : booking.isError ? (
        <div className="mx-auto max-w-3xl px-5 py-10">
          <Alert variant="destructive">
            <AlertTitle>Could not load this booking</AlertTitle>
            <AlertDescription>
              {apiErrorMessage(booking.error)}
            </AlertDescription>
          </Alert>
          <Link
            href="/bookings"
            className={buttonVariants({
              variant: "outline",
              className: "mt-5",
            })}
          >
            My bookings
          </Link>
        </div>
      ) : (
        <CheckoutReview
          booking={booking.data}
          user={user.data?.user}
          trip={trip?.trip_id === booking.data.trip_id ? trip : null}
          onPay={() => checkout.mutate()}
          paying={checkout.isPending}
          paymentError={
            checkout.isError ? apiErrorMessage(checkout.error) : undefined
          }
        />
      )}
    </main>
  );
}

export function CheckoutReview({
  booking,
  user,
  trip,
  onPay,
  paying,
  paymentError,
  preview = false,
  previewSeats = [],
}: {
  booking: BookingView;
  user?: AuthUser;
  trip?: TripSearchItem | null;
  onPay: () => void;
  paying: boolean;
  paymentError?: string;
  preview?: boolean;
  previewSeats?: SeatItem[];
}) {
  const [now, setNow] = useState(0);
  const [previewSeatChoice, setPreviewSeatChoice] = useState<SeatChoice>("assign");
  const [previewSeatClass, setPreviewSeatClass] = useState<SeatClass>("any");
  const [previewPassengerCount, setPreviewPassengerCount] = useState(booking.seats.length);
  const [previewPickerOpen, setPreviewPickerOpen] = useState(false);
  const [previewSelectedSeats, setPreviewSelectedSeats] = useState<SeatItem[]>([]);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const secondsLeft = now
    ? Math.max(
        0,
        Math.ceil((new Date(booking.expires_at).getTime() - now) / 1000),
      )
    : 0;
  const canPay = booking.status === "held" && secondsLeft > 0;
  const expiryLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 md:px-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Checkout
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Review and pay
          </h1>
        </div>
        <Link
          href={
            preview
              ? "/dev/booking-review"
              : `/bookings/${encodeURIComponent(booking.booking_id)}`
          }
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft className="size-4" />{" "}
          {preview ? "Back to panel" : "Booking details"}
        </Link>
      </div>

      <ol
        className="mb-7 flex items-center gap-3 text-xs sm:gap-5 sm:text-sm"
        aria-label="Booking progress"
      >
        <li className="flex items-center gap-2 text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
            <Check className="size-3.5" />
          </span>{" "}
          Choose seats
        </li>
        <li className="h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
        <li className="flex items-center gap-2 font-medium">
          <span className="flex size-6 items-center justify-center rounded-full border border-foreground">
            2
          </span>{" "}
          Review &amp; pay
        </li>
        <li className="h-px min-w-4 flex-1 bg-border" aria-hidden="true" />
        <li className="flex items-center gap-2 text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full border">
            3
          </span>{" "}
          Confirmed
        </li>
      </ol>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-5">
          {booking.status === "held" && (
            <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
              <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  Your seats are on hold{" "}
                  {now > 0 ? `· ${expiryLabel} remaining` : ""}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Complete payment before{" "}
                  {format(new Date(booking.expires_at), "dd MMM yyyy, HH:mm")}{" "}
                  to keep this booking.
                </p>
              </div>
            </div>
          )}
          {booking.status !== "held" && (
            <Alert>
              <AlertTitle>
                {booking.status === "confirmed"
                  ? "Booking confirmed"
                  : "This hold is no longer active"}
              </AlertTitle>
              <AlertDescription>
                {booking.status === "confirmed"
                  ? "Payment is complete. View your booking for the latest status."
                  : "Search again to choose available seats."}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Contact information</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your booking is linked to your Railway account.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="checkout-name"
                    className="mb-1.5 block text-xs font-medium"
                  >
                    Account name
                  </label>
                  <Input
                    id="checkout-name"
                    readOnly
                    value={user?.full_name ?? ""}
                    placeholder="Account holder"
                  />
                </div>
                <div>
                  <label
                    htmlFor="checkout-email"
                    className="mb-1.5 block text-xs font-medium"
                  >
                    Email
                  </label>
                  <Input
                    id="checkout-email"
                    type="email"
                    readOnly
                    value={user?.email ?? ""}
                    placeholder="Loading account email"
                  />
                </div>
              </div>
              {!user && !preview && (
                <p className="text-xs text-muted-foreground">
                  Sign in to your account to view contact details.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Contact details come from your signed-in account and cannot be
                changed during checkout.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passengers and seats</CardTitle>
              <p className="text-sm text-muted-foreground">
                These seats are included in your hold.
              </p>
            </CardHeader>
            <CardContent className="divide-y">
              {booking.seats.map((seat, index) => (
                <div
                  key={seat.seat_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {seat.full_name || `Passenger ${index + 1}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {seatTypeLabel(seat.seat_type)} · Coach{" "}
                      {seat.coach_number}, seat {seat.seat_number}
                    </p>
                  </div>
                  <Badge variant="outline">Seat {seat.seat_number}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {preview ? (
            <div className="space-y-2">
              <SeatPreference
                choice={previewSeatChoice}
                onChoiceChange={setPreviewSeatChoice}
                onSelectSeat={() => setPreviewPickerOpen(true)}
                count={previewPassengerCount}
                  onCountChange={(count) => {
                    setPreviewPassengerCount(count);
                    setPreviewSelectedSeats([]);
                  }}
                seatClass={previewSeatClass}
                onSeatClassChange={setPreviewSeatClass}
              />
              {previewSeatChoice === "select" && (
                <Button variant="outline" onClick={() => setPreviewPickerOpen(true)}>
                  Open seat map
                </Button>
              )}
              {previewSeatChoice === "select" && previewSelectedSeats.length > 0 && (
                <p className="px-1 text-sm">
                  Preview selection: {previewSelectedSeats.map((seat) => `${seat.coach_number}-${seat.seat_number}`).join(", ")}
                </p>
              )}
              {previewPickerOpen && (
                <SeatPickerDialog
                  seats={previewSeats}
                  selectedSeats={previewSelectedSeats}
                  from={booking.origin_station}
                  to={booking.destination_station}
                  trip={trip ?? null}
                  trainNumber={booking.train_number}
                  serviceDate={booking.service_date}
                  maxSeats={previewPassengerCount}
                  preview
                  onClose={() => setPreviewPickerOpen(false)}
                  onConfirm={(seats) => {
                    setPreviewSelectedSeats(seats);
                    setPreviewPickerOpen(false);
                  }}
                />
              )}
              <p className="px-1 text-xs text-muted-foreground">
                Preview controls only. The sample booking above is already held, so these choices do not change its seats or fare.
              </p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Seat preference</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your seats have already been assigned and placed on hold. Seat preferences are chosen before the hold.
                </p>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Booking access</CardTitle>
            </CardHeader>
            <CardContent className="flex items-start gap-3 text-sm">
              <LockKeyhole
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="leading-6 text-muted-foreground">
                Track this booking in{" "}
                <Link
                  href="/bookings"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  My bookings
                </Link>
                . Digital ticket delivery and station collection are not
                available in this version.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment method</CardTitle>
              <p className="text-sm text-muted-foreground">
                Complete payment securely on VNPAY after continuing.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-semibold">VNPAY</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You will be redirected to complete payment.
                  </p>
                </div>
                <Badge variant="outline">Selected</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6">
          <Card className="gap-0 py-0">
            <div className="border-b px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Trip summary
              </p>
              <div className="mt-3 flex items-center gap-2">
                <TrainFront className="size-4" aria-hidden="true" />
                <span className="font-semibold">
                  Train {booking.train_number}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(
                  new Date(`${booking.service_date}T12:00:00`),
                  "EEEE, d MMMM yyyy",
                )}
              </p>
              <div className="mt-5 space-y-4 border-l pl-4">
                <div>
                  <p className="text-sm font-medium">
                    {booking.origin_station}
                  </p>
                  {trip && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(trip.departure_at), "HH:mm")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {booking.destination_station}
                  </p>
                  {trip && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(trip.arrival_at), "HH:mm")}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                {booking.seats.length}{" "}
                {booking.seats.length === 1 ? "passenger" : "passengers"} ·{" "}
                {booking.seats.length}{" "}
                {booking.seats.length === 1 ? "seat" : "seats"}
              </p>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Total due</span>
                <strong className="text-xl tabular-nums">
                  {fareLabel(booking.fare_vnd)}
                </strong>
              </div>
              {paymentError && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {paymentError}
                </p>
              )}
              {booking.status === "held" ? (
                <Button
                  className="mt-5 w-full"
                  size="lg"
                  disabled={!canPay || preview || paying}
                  onClick={onPay}
                >
                  {preview
                    ? "Preview only"
                    : paying
                      ? "Opening payment..."
                      : canPay
                        ? "Continue to payment"
                        : "Hold expired"}
                  {canPay && !preview && !paying && (
                    <ArrowRight className="size-4" />
                  )}
                </Button>
              ) : (
                <Link
                  href={`/bookings/${encodeURIComponent(booking.booking_id)}`}
                  className={buttonVariants({
                    variant: "outline",
                    className: "mt-5 w-full",
                  })}
                >
                  View booking
                </Link>
              )}
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Booking reference: {booking.booking_id}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Your booking is confirmed only after a verified VNPAY payment
                notification.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
