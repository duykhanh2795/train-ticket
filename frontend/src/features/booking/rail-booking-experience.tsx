"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ArrowLeft, ArrowLeftRight, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUser } from "@/features/auth/api";
import { STATIONS, stationName } from "@/features/trip-search/stations";
import { tripSearchHref } from "@/features/trip-search/url";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/shared/api/client";
import { createCheckout, holdBooking, listSeats } from "./api";
import { BookingReviewSheet } from "./booking-review-sheet";
import { PassengerDetails } from "./passenger-details";
import { SeatPreference, type SeatChoice, type SeatClass } from "./seat-preference";
import { SeatPickerDialog } from "./seat-picker-dialog";
import type { SeatItem } from "./types";
import { useBookingStore } from "./store";

const searchSchema = z
  .object({
    originId: z.string().min(1),
    destinationId: z.string().min(1),
    serviceDate: z.string().min(1, "Choose a departure date"),
  })
  .refine((value) => value.originId !== value.destinationId, {
    message: "Departure and arrival stations must be different",
    path: ["destinationId"],
  });
type SearchForm = z.infer<typeof searchSchema>;

const sampleReviews = [
  {
    route: "Hanoi → Da Nang",
    title: "Finding a train",
    body: "The route and date search made it easy to compare available departures.",
  },
  {
    route: "Hanoi → Vinh",
    title: "Choosing a seat",
    body: "I could see which seats were available for the part of the journey I was taking.",
  },
  {
    route: "Da Nang → Saigon",
    title: "Keeping track",
    body: "The booking reference and payment status were easy to find afterwards.",
  },
] as const;

function clock(value: string) {
  return format(new Date(value), "HH:mm");
}

function fareLabel(amount: number | null | undefined) {
  return amount == null
    ? "Fare unavailable"
    : `${new Intl.NumberFormat("en-US").format(amount)} ₫`;
}

export function RailBookingExperience({
  bookingOnly = false,
  initialPassengerCount = 1,
}: {
  bookingOnly?: boolean;
  initialPassengerCount?: number;
} = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    search,
    trip,
    selectedSeats,
    booking,
    setSelectedSeats,
    setBooking,
    reset,
  } = useBookingStore();
  const [now, setNow] = useState(0);
  const [minDate, setMinDate] = useState("");
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>(
    {},
  );
  const [passengerError, setPassengerError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewSeats, setReviewSeats] = useState<SeatItem[]>([]);
  const [reviewNames, setReviewNames] = useState<string[]>([]);
  const [seatChoice, setSeatChoice] = useState<SeatChoice>("assign");
  const [seatClass, setSeatClass] = useState<SeatClass>("any");
  const [passengerCount, setPassengerCount] = useState(initialPassengerCount);
  const [assignedNames, setAssignedNames] = useState<Record<number, string>>({});
  const searchForm = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      originId: search?.originId ?? "HN",
      destinationId: search?.destinationId ?? "SG",
      serviceDate: search?.serviceDate ?? "",
    },
  });
  const setSearchValue = searchForm.setValue;
  const getSearchValue = searchForm.getValues;
  const originId = useWatch({ control: searchForm.control, name: "originId" });
  const destinationId = useWatch({
    control: searchForm.control,
    name: "destinationId",
  });
  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUser,
    retry: false,
  });
  const seatsQuery = useQuery({
    queryKey: ["seats", trip?.trip_id, trip?.from_stop, trip?.to_stop],
    queryFn: () => listSeats(trip!.trip_id, trip!.from_stop, trip!.to_stop),
    enabled: !!trip && !booking,
    refetchInterval: trip && !booking ? 15_000 : false,
  });
  const holdMutation = useMutation({
    mutationFn: () =>
      holdBooking({
        trip_id: trip!.trip_id,
        passengers: reviewSeats.map((item, index) => ({
          seat_id: item.seat_id,
          full_name: reviewNames[index],
        })),
        from_stop: trip!.from_stop,
        to_stop: trip!.to_stop,
      }),
    onSuccess: (result) => {
      setReviewOpen(false);
      setNow(Date.now());
      setBooking(result);
      queryClient.invalidateQueries({ queryKey: ["seats", trip?.trip_id] });
      router.push(`/checkout/${encodeURIComponent(result.booking_id)}`);
    },
    onError: () =>
      queryClient.invalidateQueries({ queryKey: ["seats", trip?.trip_id] }),
  });
  const checkoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: (result) => {
      window.location.assign(result.checkout_url);
    },
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMinDate(format(new Date(), "yyyy-MM-dd"));
      if (!getSearchValue("serviceDate")) {
        setSearchValue(
          "serviceDate",
          format(addDays(new Date(), 1), "yyyy-MM-dd"),
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [getSearchValue, setSearchValue]);

  useEffect(() => {
    if (!booking || booking.status !== "held") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [booking]);

  useEffect(() => {
    if (!trip || window.location.hash !== "#booking-flow") return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById("booking-flow")?.scrollIntoView(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [trip]);

  const secondsLeft =
    booking && now
      ? Math.max(
          0,
          Math.ceil((new Date(booking.expires_at).getTime() - now) / 1000),
        )
      : 0;
  const from = search ? stationName(search.originId) : "Hanoi";
  const to = search ? stationName(search.destinationId) : "Saigon";
  const autoSeats = [...(seatsQuery.data?.seats ?? [])]
    .filter((seat) => seat.available && seat.fare_vnd != null && (seatClass === "any" || seat.seat_type === seatClass))
    .sort((a, b) => (a.fare_vnd ?? 0) - (b.fare_vnd ?? 0) || a.coach_number.localeCompare(b.coach_number, undefined, { numeric: true }) || a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true }))
    .slice(0, passengerCount);
  const bookingSeats = seatChoice === "assign" ? autoSeats : selectedSeats;
  const selectedCurrentSeats = bookingSeats.map((selected) =>
    seatsQuery.data?.seats.find((item) => item.seat_id === selected.seat_id),
  );
  function passengerName(seat: SeatItem, index: number) {
    return (seatChoice === "assign" ? assignedNames[index] : passengerNames[seat.seat_id]) ??
      (index === 0 ? authQuery.data?.user?.full_name : "") ?? "";
  }
  function updatePassengerName(seat: SeatItem, index: number, name: string) {
    if (seatChoice === "assign") {
      setAssignedNames((current) => ({ ...current, [index]: name }));
    } else {
      setPassengerNames((current) => ({ ...current, [seat.seat_id]: name }));
    }
    setPassengerError("");
  }
  const seatsAvailable = selectedCurrentSeats.every(
    (item) => item?.available && item.fare_vnd != null,
  ) && (seatChoice !== "assign" || autoSeats.length === passengerCount);
  const estimatedFare = selectedCurrentSeats.length > 0 && selectedCurrentSeats.every(
    (item) => item?.fare_vnd != null,
  )
    ? selectedCurrentSeats.reduce((sum, item) => sum + (item?.fare_vnd ?? 0), 0)
    : null;
  function submitSearch(values: SearchForm) {
    reset();
    setPassengerNames({});
    setPassengerError("");
    router.push(tripSearchHref(values));
  }
  function swapStations() {
    const origin = searchForm.getValues("originId");
    searchForm.setValue("originId", searchForm.getValues("destinationId"), {
      shouldValidate: true,
    });
    searchForm.setValue("destinationId", origin, { shouldValidate: true });
    searchForm.clearErrors();
  }
  function searchPopularRoute(originId: string, destinationId: string) {
    const serviceDate =
      searchForm.getValues("serviceDate") ||
      format(addDays(new Date(), 1), "yyyy-MM-dd");
    searchForm.setValue("originId", originId);
    searchForm.setValue("destinationId", destinationId);
    searchForm.setValue("serviceDate", serviceDate);
    submitSearch({ originId, destinationId, serviceDate });
  }
  function startAgain() {
    const resultsHref = search ? tripSearchHref(search, { passengers: passengerCount }) : "/trains";
    reset();
    setPassengerNames({});
    setPassengerError("");
    holdMutation.reset();
    checkoutMutation.reset();
    if (bookingOnly) router.push(resultsHref);
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function reviewSelectedSeats() {
    if (!authQuery.data?.user) {
      router.push(`/login?return=booking&pax=${passengerCount}`);
      return;
    }
    if (
      bookingSeats.some(
        (item, index) =>
          passengerName(item, index).trim().length < 2,
      )
    ) {
      setPassengerError(
        "Enter a full name for each passenger (at least 2 characters).",
      );
      document.getElementById("passenger-details")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    setPassengerError("");
    holdMutation.reset();
    setReviewSeats(selectedCurrentSeats.filter((seat): seat is SeatItem => seat != null));
    setReviewNames(bookingSeats.map((seat, index) => passengerName(seat, index).trim()));
    setReviewOpen(true);
  }

  return (
    <div
      id="top"
      className={cn("railway-landing relative min-h-screen bg-background text-foreground", bookingOnly && "booking-flow-only")}
    >
      {bookingOnly && (
        <>
          <style>{`.booking-flow-only > header, .booking-flow-only > footer, .booking-flow-only > main > section:not(#booking-flow):not(.booking-empty) { display: none; }`}</style>
          <div className="mx-auto max-w-6xl px-5 pt-7 md:px-8">
            <Link href={search ? tripSearchHref(search, { passengers: passengerCount }) : "/trains"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Back to trains
            </Link>
          </div>
        </>
      )}
      <main>
        {bookingOnly && !trip && (
          <section className="booking-empty mx-auto max-w-6xl px-5 py-20 md:px-8">
            <h1 className="text-2xl font-semibold">Choose a train first</h1>
            <p className="mt-2 text-muted-foreground">Search for an available train before selecting seats.</p>
            <Link href="/trains" className={cn(buttonVariants(), "mt-6")}>Find trains</Link>
          </section>
        )}
        <section id="search" className="relative overflow-hidden bg-background">
          <div className="mx-auto grid min-h-[640px] max-w-7xl items-center gap-12 px-5 py-20 md:px-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-20 lg:py-28">
            <div className="order-2 lg:order-2">
              <Card className="gap-0 overflow-hidden rounded-xl border border-foreground/15 bg-card py-0 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.35)]">
                <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
                  <CardTitle className="text-base">Find a train</CardTitle>
                  <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                    One way
                  </span>
                </CardHeader>
                <CardContent className="p-5 sm:p-6">
                  <form
                    onSubmit={searchForm.handleSubmit(submitSearch)}
                    className="space-y-4"
                  >
                    <div className="relative rounded-lg border bg-muted/50 px-4 py-2">
                      <div className="border-b pb-2">
                        <Label
                          htmlFor="origin"
                          className="text-xs text-muted-foreground"
                        >
                          From
                        </Label>
                        <Select
                          value={originId}
                          onValueChange={(value) =>
                            searchForm.setValue("originId", String(value), {
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger
                            id="origin"
                            className="h-10 w-full border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                          >
                            <SelectValue>{stationName(originId)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="railway-landing">
                            {STATIONS.map((station) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="pt-2">
                        <Label
                          htmlFor="destination"
                          className="text-xs text-muted-foreground"
                        >
                          To
                        </Label>
                        <Select
                          value={destinationId}
                          onValueChange={(value) =>
                            searchForm.setValue(
                              "destinationId",
                              String(value),
                              { shouldValidate: true },
                            )
                          }
                        >
                          <SelectTrigger
                            id="destination"
                            className="h-10 w-full border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                          >
                            <SelectValue>
                              {stationName(destinationId)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="railway-landing">
                            {STATIONS.map((station) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Swap departure and arrival stations"
                        onClick={swapStations}
                        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-card shadow-none hover:bg-accent"
                      >
                        <ArrowLeftRight className="size-4" />
                      </Button>
                    </div>
                    <div className="rounded-lg border bg-muted/50 px-4 py-3">
                      <Label
                        htmlFor="departure-date"
                        className="text-xs text-muted-foreground"
                      >
                        Departure date
                      </Label>
                      <Input
                        id="departure-date"
                        type="date"
                        min={minDate}
                        className="mt-1 h-10 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0"
                        {...searchForm.register("serviceDate")}
                      />
                    </div>
                    {(searchForm.formState.errors.destinationId ||
                      searchForm.formState.errors.serviceDate) && (
                      <p className="text-sm text-destructive">
                        {searchForm.formState.errors.destinationId?.message ||
                          searchForm.formState.errors.serviceDate?.message}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="h-11 w-full text-sm font-semibold"
                    >
                      Search trains
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Seat availability is checked for your exact route.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>
            <div className="order-1 max-w-2xl lg:order-1">
              <p className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="h-px w-8 bg-foreground" /> Rail travel in
                Vietnam
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl xl:text-7xl">
                Find your train.
                <br />
                <span className="text-muted-foreground">Choose your seat.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground">
                Search by route and date, see seats available on your segment,
                and keep your booking details in one place.
              </p>
            </div>
          </div>
        </section>
        <section className="border-y bg-muted/40">
          <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-10 px-5 py-14 sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:py-18">
            <div className="border-l border-foreground/20 pl-5">
              <span className="text-xs font-mono text-muted-foreground">
                01 / SEARCH
              </span>
              <h2 className="mt-8 text-sm font-semibold">Search by route</h2>
              <p className="mt-2 max-w-60 text-sm leading-6 text-muted-foreground">
                Choose your stations and departure date.
              </p>
            </div>
            <div className="border-l border-foreground/20 pl-5">
              <span className="text-xs font-mono text-muted-foreground">
                02 / SEATS
              </span>
              <h2 className="mt-8 text-sm font-semibold">
                Seats for your segment
              </h2>
              <p className="mt-2 max-w-60 text-sm leading-6 text-muted-foreground">
                Check availability for the exact part of your journey.
              </p>
            </div>
            <div className="border-l border-foreground/20 pl-5">
              <span className="text-xs font-mono text-muted-foreground">
                03 / HOLD
              </span>
              <h2 className="mt-8 text-sm font-semibold">A 10-minute hold</h2>
              <p className="mt-2 max-w-60 text-sm leading-6 text-muted-foreground">
                Finish passenger details and payment after holding a seat.
              </p>
            </div>
            <div className="border-l border-foreground/20 pl-5">
              <span className="text-xs font-mono text-muted-foreground">
                04 / PAYMENT
              </span>
              <h2 className="mt-8 text-sm font-semibold">Pay with VNPAY</h2>
              <p className="mt-2 max-w-60 text-sm leading-6 text-muted-foreground">
                Your booking is confirmed after successful payment.
              </p>
            </div>
          </div>
        </section>

        {trip && (
          <section
            id="booking-flow"
            className="mx-auto max-w-6xl scroll-mt-24 px-5 py-10 md:px-8"
          >
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-foreground">
                  NEXT STEP
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {booking?.status === "confirmed"
                    ? "Booking confirmed"
                    : booking
                      ? "Your seats"
                      : "Choose your seats"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Train {trip.train_number} · {from} → {to}
                </p>
              </div>
              <Button variant="ghost" onClick={startAgain}>
                <ArrowLeft className="size-4" /> Search again
              </Button>
            </div>
            {booking ? (
              <Card className="bg-card">
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-4">
                    <div>
                      <Badge
                        variant="outline"
                        className="border-border text-foreground"
                      >
                        {booking.status === "confirmed"
                          ? "CONFIRMED"
                          : "SEATS HELD"}
                      </Badge>
                      <h3 className="mt-2 text-base font-semibold text-foreground">
                        {booking.status === "confirmed"
                          ? "Your journey is booked"
                          : "Your seats are on hold"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Booking reference <strong>{booking.booking_id}</strong>
                      </p>
                      <Link
                        href={`/bookings/${encodeURIComponent(booking.booking_id)}`}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
                      >
                        View booking details
                      </Link>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Train {trip.train_number} · {bookingSeats.length} seats
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        Final fare: {fareLabel(booking.fare_vnd)}
                      </p>
                      {booking.status === "held" && (
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          Time remaining:{" "}
                          {String(Math.floor(secondsLeft / 60)).padStart(
                            2,
                            "0",
                          )}
                          :{String(secondsLeft % 60).padStart(2, "0")}
                        </p>
                      )}
                    </div>
                  </div>
                  {booking.status === "held" && (
                    <div className="flex flex-col gap-2">
                      <Button
                        disabled={
                          secondsLeft === 0 || checkoutMutation.isPending
                        }
                        onClick={() =>
                          checkoutMutation.mutate(booking.booking_id)
                        }
                      >
                        {checkoutMutation.isPending
                          ? "Opening VNPAY..."
                          : "Pay with VNPAY"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Your booking is confirmed only after VNPAY reports a
                        successful payment.
                      </span>
                      {checkoutMutation.isError && (
                        <p className="text-sm text-destructive">
                          {apiErrorMessage(checkoutMutation.error)}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
                <div className="space-y-5">
                <SeatPreference
                  choice={seatChoice}
                  onChoiceChange={(choice) => { setSeatChoice(choice); setPassengerError(""); setReviewOpen(false); }}
                  onSelectSeat={() => {
                    if (seatsQuery.data?.seats.length) setPickerOpen(true);
                  }}
                  count={passengerCount}
                  onCountChange={(count) => { setPassengerCount(count); setPassengerError(""); setReviewOpen(false); }}
                  seatClass={seatClass}
                  onSeatClassChange={(value) => { setSeatClass(value); setPassengerError(""); setReviewOpen(false); }}
                />
                {seatChoice === "assign" && seatsQuery.isPending && (
                  <Skeleton className="h-24 rounded-xl" />
                )}
                {pickerOpen && (
                  <SeatPickerDialog
                    seats={seatsQuery.data?.seats ?? []}
                    selectedSeats={selectedSeats}
                    from={from}
                    to={to}
                    trip={trip}
                    trainNumber={trip.train_number}
                    serviceDate={trip.service_date}
                    maxSeats={6}
                    onClose={() => setPickerOpen(false)}
                    onConfirm={(seats) => {
                      setSelectedSeats(seats);
                      setPickerOpen(false);
                    }}
                  />
                )}
                {seatChoice === "assign" && seatsQuery.isError && (
                  <Alert variant="destructive">
                    <AlertTitle>Could not load available seats</AlertTitle>
                    <AlertDescription>
                      {apiErrorMessage(seatsQuery.error)}{" "}
                      <Button variant="outline" size="sm" onClick={() => seatsQuery.refetch()}>
                        Try again
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {seatChoice === "assign" && seatsQuery.data && autoSeats.length < passengerCount && (
                  <Alert>
                    <AlertTitle>Not enough seats available</AlertTitle>
                    <AlertDescription>Choose fewer passengers, another class, or select seats yourself.</AlertDescription>
                  </Alert>
                )}
                {seatChoice === "select" && (
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle>Choose exact seats</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Browse coaches and choose up to six seats before placing a hold.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {seatsQuery.isError && (
                        <p className="mb-3 text-sm text-destructive">{apiErrorMessage(seatsQuery.error)}</p>
                      )}
                      <Button variant="outline" onClick={() => setPickerOpen(true)} disabled={!seatsQuery.data?.seats.length}>
                        Open seat map
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {bookingSeats.length > 0 && (
                  <PassengerDetails
                    seats={bookingSeats}
                    names={bookingSeats.map(passengerName)}
                    onNameChange={updatePassengerName}
                    error={passengerError}
                  />
                )}
                </div>
                <Card className="h-fit bg-card lg:sticky lg:top-24">
                  <CardHeader>
                    <div className="flex items-center justify-between text-xs font-bold tracking-widest text-foreground">
                      <span>BOOKING SUMMARY</span>
                    </div>
                    <CardTitle className="mt-1 text-base">
                      Your journey
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {clock(trip.departure_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">{from}</p>
                      </div>
                      <span className="h-px w-8 bg-border" aria-hidden="true" />
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {clock(trip.arrival_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">{to}</p>
                      </div>
                    </div>
                    <Separator />
                    <SummaryRow label="Train" value={trip.train_number} />
                    <SummaryRow
                      label="Departure date"
                      value={format(new Date(trip.departure_at), "dd/MM/yyyy")}
                    />
                    <SummaryRow
                      label={seatChoice === "assign" ? "Suggested seats" : "Seats"}
                      value={
                        bookingSeats.length
                          ? bookingSeats
                              .map(
                                (item) =>
                                  `${item.coach_number}-${item.seat_number}`,
                              )
                              .join(", ")
                          : "None selected"
                      }
                    />
                    <SummaryRow
                      label="Estimated fare"
                      value={fareLabel(estimatedFare)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {seatChoice === "assign" ? "Suggestions may change until you place a hold. " : ""}
                      The final fare is calculated when your seats are held.
                    </p>
                    {bookingSeats.length > 0 && (
                      <SummaryRow
                        label="Passenger names"
                        value={`${bookingSeats.filter((seat, index) => passengerName(seat, index).trim().length >= 2).length}/${bookingSeats.length} complete`}
                      />
                    )}
                    <Separator />
                    {authQuery.data?.user ? (
                      <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {authQuery.data.user.full_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {authQuery.data.user.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sign in or create an account to hold these seats.
                      </p>
                    )}
                    {holdMutation.isError && (
                      <p className="text-sm text-destructive">
                        {apiErrorMessage(holdMutation.error)}
                      </p>
                    )}
                    <Button
                      className="w-full"
                      onClick={reviewSelectedSeats}
                      disabled={
                        bookingSeats.length === 0 ||
                        !seatsAvailable ||
                        holdMutation.isPending
                      }
                    >
                      {holdMutation.isPending
                        ? "Holding seats..."
                        : authQuery.data?.user
                          ? `Review ${bookingSeats.length} ${bookingSeats.length === 1 ? "seat" : "seats"}`
                          : "Sign in to hold seats"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Seats are held for 10 minutes after confirmation.
                    </p>
                  </CardContent>
                </Card>
                <BookingReviewSheet
                  open={reviewOpen}
                  onOpenChange={setReviewOpen}
                  trip={trip}
                  from={from}
                  to={to}
                  seats={reviewSeats}
                  passengerNames={reviewNames}
                  estimatedFare={reviewSeats.length && reviewSeats.every((seat) => seat.fare_vnd != null)
                    ? reviewSeats.reduce((sum, seat) => sum + (seat.fare_vnd ?? 0), 0)
                    : null}
                  canConfirm={reviewSeats.length > 0 && reviewSeats.every((seat) =>
                    seatsQuery.data?.seats.some((current) => current.seat_id === seat.seat_id && current.available && current.fare_vnd === seat.fare_vnd))}
                  pending={holdMutation.isPending}
                  error={
                    holdMutation.isError
                      ? apiErrorMessage(holdMutation.error)
                      : undefined
                  }
                  onConfirm={() => holdMutation.mutate()}
                />
              </div>
            )}
          </section>
        )}

        <section
          id="journey"
          className="bg-[#111111] py-20 text-white sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              HOW BOOKING WORKS
            </p>
            <h2 className="mt-6 max-w-5xl text-4xl font-medium leading-[1.12] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              Every step is clear.
              <span className="text-white/40">
                {" "}
                From departure to seat selection.
              </span>
            </h2>
            <div className="mt-16 grid border-t border-white/20 md:grid-cols-3">
              <div className="border-b border-white/20 py-8 md:border-b-0 md:border-r md:pr-8">
                <span className="text-xs font-mono text-white/40">
                  01 / SEARCH
                </span>
                <div
                  className="mt-12 h-px w-12 bg-white/50"
                  aria-hidden="true"
                />
                <h3 className="mt-8 text-base font-semibold">
                  Compare departures
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-white/55">
                  Search by stations and date to find a train that fits your
                  plans.
                </p>
              </div>
              <div className="border-b border-white/20 py-8 md:border-b-0 md:border-r md:px-8">
                <span className="text-xs font-mono text-white/40">
                  02 / SELECT
                </span>
                <div
                  className="mt-12 h-px w-12 bg-white/50"
                  aria-hidden="true"
                />
                <h3 className="mt-8 text-base font-semibold">
                  Check your seats
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-white/55">
                  See which seats are available on your exact travel segment.
                </p>
              </div>
              <div className="py-8 md:pl-8">
                <span className="text-xs font-mono text-white/40">
                  03 / CONFIRM
                </span>
                <div
                  className="mt-12 h-px w-12 bg-white/50"
                  aria-hidden="true"
                />
                <h3 className="mt-8 text-base font-semibold">Hold, then pay</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-white/55">
                  Complete passenger details and payment during the seat hold.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="popular-routes"
          className="border-t bg-muted/40 py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  ROUTES
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                  Where to next?
                </h2>
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                Choose a route to see trains for your selected date.
              </p>
            </div>
            <div className="grid gap-x-12 md:grid-cols-2">
              {[
                { origin: "HN", destination: "SG", label: "Hanoi → Saigon" },
                { origin: "HN", destination: "DN", label: "Hanoi → Da Nang" },
                { origin: "DN", destination: "SG", label: "Da Nang → Saigon" },
                { origin: "HN", destination: "VINH", label: "Hanoi → Vinh" },
                { origin: "VINH", destination: "DN", label: "Vinh → Da Nang" },
                {
                  origin: "ND",
                  destination: "SG",
                  label: "Nam Dinh → Saigon",
                },
              ].map((route) => (
                <button
                  key={route.label}
                  type="button"
                  onClick={() =>
                    searchPopularRoute(route.origin, route.destination)
                  }
                  className="group flex w-full items-center justify-between gap-4 border-b border-border py-4 text-left text-sm font-semibold transition-colors hover:text-primary sm:text-base"
                >
                  {route.label}
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section
          id="reviews"
          aria-labelledby="reviews-heading"
          className="border-t bg-background py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                PASSENGER PERSPECTIVE
              </p>
              <h2
                id="reviews-heading"
                className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
              >
                The details passengers notice.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                A look at the booking experience from the other side of the
                screen.
              </p>
            </div>
            <div className="grid border-t md:grid-cols-3">
              {sampleReviews.map((review, index) => (
                <article
                  key={review.route}
                  className="flex flex-col border-b py-8 md:border-b-0 md:border-r md:px-8 md:last:border-r-0 md:first:pl-0"
                >
                  <span className="text-xs font-mono text-muted-foreground">
                    0{index + 1} / {review.route}
                  </span>
                  <h3 className="mt-8 text-lg font-medium tracking-tight">
                    {review.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">
                    “{review.body}”
                  </p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Illustrative feedback for this demo. Verified customer reviews
              will appear when available.
            </p>
          </div>
        </section>

        <section id="help" className="border-t bg-background py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                GOOD TO KNOW
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
                Frequently asked questions
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                The practical details on seats, holds, and payment.
              </p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                  How long is a seat held?
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  After a successful hold, you have 10 minutes to pay. If the
                  hold expires, the seat may become available to others.
                </p>
              </details>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                  Why is a seat available on another segment?
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Availability is calculated for each part of a train&apos;s
                  route. A seat booked on one segment can still be available on
                  a later segment that does not overlap.
                </p>
              </details>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                  When is my booking confirmed?
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Your booking is confirmed when the system receives a
                  successful payment notification from VNPAY. You can check its
                  status in My bookings.
                </p>
              </details>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="next-journey-heading"
          className="border-t bg-muted/40 py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                NEXT STEPS
              </p>
              <h2
                id="next-journey-heading"
                className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
              >
                What would you like to do?
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <a
                href="#search"
                className="group flex min-h-60 flex-col justify-between border bg-card p-7 transition-colors hover:bg-muted/50 sm:p-9"
              >
                <span className="text-xs font-mono text-muted-foreground">
                  01 / SEARCH
                </span>
                <div className="mt-12">
                  <h3 className="text-2xl font-medium tracking-tight">
                    Find a train
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Search departures and check seats for your route.
                  </p>
                  <span className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
                    Search trains
                  </span>
                </div>
              </a>
              <Link
                href="/bookings"
                className="group flex min-h-60 flex-col justify-between border bg-card p-7 transition-colors hover:bg-muted/50 sm:p-9"
              >
                <span className="text-xs font-mono text-muted-foreground">
                  02 / MANAGE
                </span>
                <div className="mt-12">
                  <h3 className="text-2xl font-medium tracking-tight">
                    My bookings
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    View your booking reference, seats, and payment status.
                  </p>
                  <span className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
                    Open bookings
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="bg-[#111111] text-white">
        <div className="mx-auto max-w-7xl px-5 pb-8 pt-14 md:px-8 sm:pt-16">
          <div className="grid gap-10 border-b border-white/15 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)] lg:gap-12">
            <div className="max-w-sm">
              <a
                href="#top"
                className="inline-flex items-center gap-2 text-xl font-bold tracking-tight"
                aria-label="Railway home"
              >
                railway<span className="text-white/50">.</span>
              </a>
              <p className="mt-5 text-sm leading-6 text-white/65">
                Search trains, choose seats for your route, and keep your
                booking details close at hand.
              </p>
            </div>

            <nav aria-label="Explore">
              <h2 className="text-sm font-semibold">Explore</h2>
              <ul className="mt-5 space-y-3 text-sm text-white/65">
                <li>
                  <a
                    className="transition-colors hover:text-white"
                    href="#search"
                  >
                    Search trains
                  </a>
                </li>
                <li>
                  <a
                    className="transition-colors hover:text-white"
                    href="#popular-routes"
                  >
                    Routes
                  </a>
                </li>
                <li>
                  <a
                    className="transition-colors hover:text-white"
                    href="#journey"
                  >
                    How booking works
                  </a>
                </li>
                <li>
                  <a
                    className="transition-colors hover:text-white"
                    href="#reviews"
                  >
                    Passenger feedback
                  </a>
                </li>
              </ul>
            </nav>

            <nav aria-label="Account">
              <h2 className="text-sm font-semibold">Account</h2>
              <ul className="mt-5 space-y-3 text-sm text-white/65">
                <li>
                  <Link
                    className="transition-colors hover:text-white"
                    href="/bookings"
                  >
                    My bookings
                  </Link>
                </li>
                <li>
                  <Link
                    className="transition-colors hover:text-white"
                    href="/login"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link
                    className="transition-colors hover:text-white"
                    href="/register"
                  >
                    Create an account
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Information">
              <h2 className="text-sm font-semibold">Information</h2>
              <ul className="mt-5 space-y-3 text-sm text-white/65">
                <li>
                  <a
                    className="transition-colors hover:text-white"
                    href="#help"
                  >
                    FAQs
                  </a>
                </li>
                <li>
                  <a
                    className="transition-colors hover:text-white"
                    href="#journey"
                  >
                    How to book
                  </a>
                </li>
                <li>
                  <a
                    className="transition-colors hover:text-white"
                    href="#help"
                  >
                    Holds and payment
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div className="flex flex-col gap-3 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
            <span>© railway. A demonstration railway booking project.</span>
            <a
              href="#top"
              className="inline-flex items-center gap-1 transition-colors hover:text-white"
            >
              Back to top
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right text-foreground">{value}</strong>
    </div>
  );
}
