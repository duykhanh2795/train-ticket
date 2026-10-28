"use client";

import { Fragment, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, TrainFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SeatItem } from "./types";
import type { TripSearchItem } from "@/features/trip-search/types";

function fare(amount: number) {
  return `${new Intl.NumberFormat("en-US").format(amount)} ₫`;
}

type SeatAppearance = "available" | "selected" | "occupied";

function SeatGlyph({
  appearance,
  className,
}: {
  appearance: SeatAppearance;
  className?: string;
}) {
  const selected = appearance === "selected";
  const occupied = appearance === "occupied";
  const outline = selected ? "white" : occupied ? "var(--border)" : "#326dff";
  const fill = selected
    ? "#326dff"
    : occupied
      ? "var(--muted)"
      : "var(--background)";

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="9"
        y="5"
        width="30"
        height="13"
        rx="4"
        fill={fill}
        stroke={outline}
        strokeWidth="2"
      />
      <rect
        x="6"
        y="13"
        width="36"
        height="29"
        rx="5"
        fill={fill}
        stroke={outline}
        strokeWidth="2"
      />
      <rect
        x="2"
        y="19"
        width="5"
        height="13"
        rx="2"
        fill={fill}
        stroke={outline}
        strokeWidth="2"
      />
      <rect
        x="41"
        y="19"
        width="5"
        height="13"
        rx="2"
        fill={fill}
        stroke={outline}
        strokeWidth="2"
      />
      <path
        d="M11 35V21a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v14"
        stroke={selected ? "white" : outline}
        strokeOpacity={selected ? 0.55 : 0.7}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function journeyDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function journeyTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function journeyDuration(from: string, to: string) {
  const minutes = Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000),
  );
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function CoachSeatSection({
  coach,
  seats,
  selected,
  maxSeats,
  onToggle,
  preview,
}: {
  coach: string;
  seats: SeatItem[];
  selected: SeatItem[];
  maxSeats: number;
  onToggle: (seat: SeatItem) => void;
  preview: boolean;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Coach {coach}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {seats.filter((seat) => seat.available).length} seats available
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Travel direction
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      {preview && (
        <div
          className="mx-auto mt-4 flex max-w-xs justify-between gap-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          aria-label="Illustrative coach facilities"
        >
          <span className="rounded bg-muted px-3 py-2">WC</span>
          <span className="rounded bg-muted px-3 py-2">Luggage</span>
        </div>
      )}
      <div
        className="mx-auto mt-4 grid max-w-xs grid-cols-[repeat(2,minmax(0,1fr))_32px_repeat(2,minmax(0,1fr))] gap-x-2 gap-y-2"
        aria-label={`Seats in coach ${coach}`}
      >
        {seats.map((seat, index) => {
          const chosen = selected.some((item) => item.seat_id === seat.seat_id);
          const appearance: SeatAppearance = chosen
            ? "selected"
            : seat.available && seat.fare_vnd != null
              ? "available"
              : "occupied";
          return (
            <Fragment key={seat.seat_id}>
              <div className={cn(index % 4 === 2 && "col-start-4")}>
                <button
                  type="button"
                  disabled={
                    !seat.available ||
                    seat.fare_vnd == null ||
                    (!chosen && selected.length >= maxSeats)
                  }
                  aria-pressed={chosen}
                  aria-label={`Coach ${coach}, seat ${seat.seat_number}, ${chosen ? "selected" : !seat.available ? "occupied" : seat.fare_vnd == null ? "fare unavailable" : `available, ${fare(seat.fare_vnd)}`}`}
                  onClick={() => onToggle(seat)}
                  className={cn(
                    "relative flex size-12 items-center justify-center rounded-lg text-xs font-bold tabular-nums transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    appearance === "selected"
                      ? "text-white"
                      : appearance === "available"
                        ? "text-[#326dff] hover:-translate-y-0.5"
                        : "cursor-not-allowed text-muted-foreground/40",
                  )}
                >
                  <SeatGlyph
                    appearance={appearance}
                    className="absolute inset-0 size-full"
                  />
                  {appearance !== "occupied" && (
                    <span className="relative z-10 mt-1">
                      {seat.seat_number}
                    </span>
                  )}
                </button>
              </div>
              {preview &&
                index % 4 === 3 &&
                index + 1 < seats.length &&
                [1, 4].includes(Math.floor(index / 4)) && (
                  <div
                    className="col-span-5 grid grid-cols-[1fr_32px_1fr] gap-2 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                    aria-label="Illustrative table and luggage space"
                  >
                    <span className="flex h-7 items-center justify-center rounded bg-muted/80">
                      Table
                    </span>
                    <span aria-hidden="true" />
                    <span className="flex h-7 items-center justify-center rounded bg-muted/80">
                      Luggage
                    </span>
                  </div>
                )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function SeatPickerDialog({
  seats,
  selectedSeats,
  from,
  to,
  trip,
  trainNumber,
  serviceDate,
  maxSeats,
  onClose,
  onConfirm,
  preview = false,
}: {
  seats: SeatItem[];
  selectedSeats: SeatItem[];
  from: string;
  to: string;
  trip: TripSearchItem | null;
  trainNumber: string;
  serviceDate: string;
  maxSeats: number;
  onClose: () => void;
  onConfirm: (seats: SeatItem[]) => void;
  preview?: boolean;
}) {
  const coaches = Array.from(new Set(seats.map((seat) => seat.coach_number)));
  const coachRail = useRef<HTMLDivElement>(null);
  const coachButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const seatScroller = useRef<HTMLDivElement>(null);
  const coachSections = useRef<Record<string, HTMLElement | null>>({});
  const [coach, setCoach] = useState(coaches[0] ?? "");
  const [draft, setDraft] = useState(
    selectedSeats.filter((seat) =>
      seats.some(
        (current) => current.seat_id === seat.seat_id && current.available,
      ),
    ),
  );
  const selectedTotal = draft.reduce(
    (sum, seat) => sum + (seat.fare_vnd ?? 0),
    0,
  );

  function toggle(seat: SeatItem) {
    if (!seat.available || seat.fare_vnd == null) return;
    setDraft((current) =>
      current.some((item) => item.seat_id === seat.seat_id)
        ? current.filter((item) => item.seat_id !== seat.seat_id)
        : current.length < maxSeats
          ? [...current, seat]
          : current,
    );
  }

  function jumpToCoach(nextCoach: string) {
    const scroller = seatScroller.current;
    const target = coachSections.current[nextCoach];
    if (!scroller || !target) return;
    const top =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTo({ top, behavior: "smooth" });
    setCoach(nextCoach);
  }

  function trackVisibleCoach() {
    const scroller = seatScroller.current;
    if (!scroller) return;
    const threshold = scroller.getBoundingClientRect().top + 80;
    let visible = coaches[0] ?? "";
    for (const item of coaches) {
      const section = coachSections.current[item];
      if (section && section.getBoundingClientRect().top <= threshold)
        visible = item;
    }
    if (
      scroller.scrollTop + scroller.clientHeight >=
      scroller.scrollHeight - 2
    ) {
      visible = coaches.at(-1) ?? visible;
    }
    setCoach(visible);
    const rail = coachRail.current;
    const button = coachButtons.current[visible];
    if (!rail || !button) return;
    const railBounds = rail.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    if (window.matchMedia("(min-width: 768px)").matches) {
      if (buttonBounds.top < railBounds.top)
        rail.scrollBy({ top: buttonBounds.top - railBounds.top });
      else if (buttonBounds.bottom > railBounds.bottom)
        rail.scrollBy({ top: buttonBounds.bottom - railBounds.bottom });
    } else {
      if (buttonBounds.left < railBounds.left)
        rail.scrollBy({ left: buttonBounds.left - railBounds.left });
      else if (buttonBounds.right > railBounds.right)
        rail.scrollBy({ left: buttonBounds.right - railBounds.right });
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <div className="border-b px-5 py-5 pr-14 sm:px-7 sm:pr-14">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Choose your seats
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Select up to {maxSeats} {maxSeats === 1 ? "seat" : "seats"}.
            Availability is checked again when you place the hold.
          </DialogDescription>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] md:grid-cols-[240px_minmax(0,1fr)_68px] md:grid-rows-1">
          <aside className="border-b bg-muted/25 p-5 md:col-start-1 md:row-start-1 md:overflow-y-auto md:border-b-0 md:border-r">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Journey
            </p>
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrainFront className="size-4" aria-hidden="true" />
                Train {trainNumber}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {trip ? journeyDate(trip.departure_at) : serviceDate} · Direct
                journey
              </p>
              <div className="relative mt-5 space-y-5 border-l border-border pl-4">
                <div className="relative">
                  <i className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-foreground bg-background" />
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {trip ? journeyTime(trip.departure_at) : "Time unavailable"}
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-5">{from}</p>
                  {trip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {journeyDate(trip.departure_at)}
                    </p>
                  )}
                </div>
                <div className="relative">
                  <i className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-foreground bg-foreground" />
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {trip ? journeyTime(trip.arrival_at) : "Time unavailable"}
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-5">{to}</p>
                  {trip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {journeyDate(trip.arrival_at)}
                    </p>
                  )}
                </div>
              </div>
              {trip && (
                <p className="mt-5 border-t pt-3 text-xs text-muted-foreground">
                  Journey time{" "}
                  {journeyDuration(trip.departure_at, trip.arrival_at)}
                </p>
              )}
            </div>
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Your selection
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {draft.length
                  ? draft
                      .map((seat) => `${seat.coach_number}-${seat.seat_number}`)
                      .join(", ")
                  : "Choose seats from any coach."}
              </p>
            </div>
          </aside>
          <div className="row-start-3 flex min-h-0 flex-col md:col-start-2 md:row-start-1">
            <div
              ref={seatScroller}
              onScroll={trackVisibleCoach}
              tabIndex={0}
              aria-label="Seat maps for all coaches"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-200/70 p-5 focus-visible:outline-2 focus-visible:outline-ring sm:p-7 dark:bg-zinc-800/80"
            >
              {coaches.map((item) => (
                <section
                  key={item}
                  ref={(node) => {
                    coachSections.current[item] = node;
                  }}
                  aria-label={`Coach ${item}`}
                  className="mx-auto mb-3 w-full max-w-[31rem] rounded-xl bg-background px-5 py-5 last:mb-0 sm:px-6"
                >
                  <CoachSeatSection
                    coach={item}
                    seats={seats.filter((seat) => seat.coach_number === item)}
                    selected={draft}
                    maxSeats={maxSeats}
                    onToggle={toggle}
                    preview={preview}
                  />
                </section>
              ))}
              <p className="mx-auto max-w-md text-center text-xs text-muted-foreground">
                {preview
                  ? "Tables and facilities shown here are sample layout details, not real train data."
                  : "Schematic seat list; physical position and facilities are not supplied for this train."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t bg-background px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <SeatGlyph appearance="available" className="size-5" />{" "}
                Available
              </span>
              <span className="flex items-center gap-2">
                <SeatGlyph appearance="selected" className="size-5" /> Selected
              </span>
              <span className="flex items-center gap-2">
                <SeatGlyph appearance="occupied" className="size-5" /> Occupied
              </span>
            </div>
          </div>
          <nav
            aria-label="Choose coach"
            className="row-start-2 flex min-h-0 border-b bg-muted/25 px-3 py-2 md:col-start-3 md:row-start-1 md:flex-col md:border-b-0 md:border-l md:px-2 md:py-4"
          >
            <button
              type="button"
              aria-label="Scroll coaches up"
              onClick={() =>
                coachRail.current?.scrollBy({ top: -184, behavior: "smooth" })
              }
              className="hidden h-9 items-center justify-center rounded-lg hover:bg-background focus-visible:outline-2 focus-visible:outline-ring md:flex"
            >
              <ChevronUp className="size-4" />
            </button>
            <div
              ref={coachRail}
              className="flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:my-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto"
            >
              {coaches.map((item) => {
                const selected = draft.filter(
                  (seat) => seat.coach_number === item,
                ).length;
                const available = seats.filter(
                  (seat) => seat.coach_number === item && seat.available,
                ).length;
                return (
                  <button
                    key={item}
                    ref={(node) => {
                      coachButtons.current[item] = node;
                    }}
                    type="button"
                    aria-label={`Coach ${item}, ${available} seats available${selected ? `, ${selected} selected` : ""}`}
                    aria-current={coach === item ? "true" : undefined}
                    onClick={() => jumpToCoach(item)}
                    className={cn(
                      "relative flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring md:h-16 md:w-full",
                      coach === item
                        ? "border-foreground bg-background shadow-sm"
                        : "border-transparent",
                    )}
                  >
                    {item}
                    {selected > 0 && (
                      <span
                        className="absolute bottom-1 size-1 rounded-full bg-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Scroll coaches down"
              onClick={() =>
                coachRail.current?.scrollBy({ top: 184, behavior: "smooth" })
              }
              className="hidden h-9 items-center justify-center rounded-lg hover:bg-background focus-visible:outline-2 focus-visible:outline-ring md:flex"
            >
              <ChevronDown className="size-4" />
            </button>
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-background px-5 py-4 sm:px-7">
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {draft.length ? fare(selectedTotal) : "Select seats"}
            </p>
            <p className="text-xs text-muted-foreground">
              {draft.length} / {maxSeats} selected
              {preview ? " · preview only" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft([])}
              disabled={!draft.length}
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm(draft)}
              disabled={!draft.length}
            >
              Confirm seats
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
