"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiErrorMessage } from "@/shared/api/client";
import { adminAccess, createStation, createTrip, listBookings, listStations, listTrips, type NewTrip } from "./api";

type StopDraft = { station_id: string; arrival_at: string; departure_at: string };
type SeatDraft = { coach_number: string; seat_type: "standard" | "sleeper" | "vip"; seat_count: string };

const emptyStop = (): StopDraft => ({ station_id: "", arrival_at: "", departure_at: "" });
const initialSeats = (): SeatDraft[] => [{ coach_number: "1", seat_type: "standard", seat_count: "72" }];
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

function vietnamInstant(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function AdminPage() {
  const client = useQueryClient();
  const access = useQuery({ queryKey: ["admin", "access"], queryFn: adminAccess, retry: false });
  const allowed = access.data === true;
  const stations = useQuery({ queryKey: ["admin", "stations"], queryFn: listStations, enabled: allowed });
  const [tripOffset, setTripOffset] = useState(0);
  const [bookingOffset, setBookingOffset] = useState(0);
  const trips = useQuery({ queryKey: ["admin", "trips", tripOffset], queryFn: () => listTrips(tripOffset), enabled: allowed });
  const bookings = useQuery({ queryKey: ["admin", "bookings", bookingOffset], queryFn: () => listBookings(bookingOffset), enabled: allowed });
  const [stationDraft, setStationDraft] = useState({ code: "", name: "", city: "" });
  const stationCreate = useMutation({
    mutationFn: createStation,
    onSuccess: () => { setStationDraft({ code: "", name: "", city: "" }); void client.invalidateQueries({ queryKey: ["admin", "stations"] }); },
  });
  const [trainNumber, setTrainNumber] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [stops, setStops] = useState<StopDraft[]>([emptyStop(), emptyStop()]);
  const [seats, setSeats] = useState<SeatDraft[]>(initialSeats);
  const [fares, setFares] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const tripCreate = useMutation({
    mutationFn: createTrip,
    onSuccess: () => {
      setTrainNumber(""); setServiceDate(""); setStops([emptyStop(), emptyStop()]); setSeats(initialSeats()); setFares({}); setFormError("");
      setTripOffset(0);
      void client.invalidateQueries({ queryKey: ["admin", "trips"] });
    },
  });
  const seatTypes = [...new Set(seats.map((seat) => seat.seat_type))];

  function submitTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!trainNumber.trim() || !serviceDate || stops.some((stop) => !stop.station_id) || seats.some((seat) => !seat.coach_number.trim() || !seat.seat_count)) {
      setFormError("Enter a train, date, every station and each coach's seat count."); return;
    }
    const tripStops = stops.map((stop, index) => ({
      station_id: stop.station_id,
      arrival_at: index === 0 ? null : vietnamInstant(stop.arrival_at),
      departure_at: index === stops.length - 1 ? null : vietnamInstant(stop.departure_at),
    }));
    if (tripStops.some((stop, index) => (index > 0 && !stop.arrival_at) || (index < stops.length - 1 && !stop.departure_at))) {
      setFormError("Enter arrival and departure times for each applicable stop (Vietnam time)."); return;
    }
    const tripFares: NewTrip["fares"] = [];
    for (let leg = 0; leg < stops.length - 1; leg++) {
      for (const seatType of seatTypes) {
        const amount = Number(fares[`${leg}:${seatType}`]);
        if (!Number.isSafeInteger(amount) || amount <= 0) { setFormError("Enter a positive fare for every leg and seat type."); return; }
        tripFares.push({ from_stop: leg, seat_type: seatType, amount_vnd: amount });
      }
    }
    tripCreate.mutate({
      train_number: trainNumber.trim(), service_date: serviceDate, stops: tripStops,
      seat_groups: seats.map((seat) => ({ coach_number: seat.coach_number.trim(), seat_type: seat.seat_type, seat_count: Number(seat.seat_count) })),
      fares: tripFares,
    });
  }

  if (access.isPending) return <main className="mx-auto max-w-6xl px-5 py-12 text-foreground">Checking admin access…</main>;
  if (!allowed) return (
    <main className="mx-auto max-w-6xl px-5 py-12 text-foreground">
      <h1 className="text-3xl font-semibold">Admin access required</h1>
      <p className="mt-3 text-muted-foreground">{access.error instanceof ApiError && access.error.status === 401 ? "Sign in with an administrator account." : access.error instanceof ApiError && access.error.status === 403 ? "This account does not have administrator permission." : access.isError ? apiErrorMessage(access.error) : "This account does not have administrator permission."}</p>
      <Link className="mt-5 inline-block underline" href="/login?return=admin">Sign in</Link>
    </main>
  );

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground">
      <div className="mx-auto max-w-6xl space-y-8">
        <header><p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">RAILWAY OPERATIONS</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Admin</h1><p className="mt-2 text-muted-foreground">Manage stations and publish complete train schedules. Bookings are read only.</p></header>

        <Card id="stations"><CardHeader><CardTitle>Stations</CardTitle></CardHeader><CardContent className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); stationCreate.mutate(stationDraft); }}>
            <div className="space-y-1"><Label htmlFor="station-code">Code</Label><Input id="station-code" required maxLength={12} value={stationDraft.code} onChange={(event) => setStationDraft({ ...stationDraft, code: event.target.value.toUpperCase() })} placeholder="HAN" /></div>
            <div className="space-y-1"><Label htmlFor="station-name">Station</Label><Input id="station-name" required value={stationDraft.name} onChange={(event) => setStationDraft({ ...stationDraft, name: event.target.value })} placeholder="Hanoi station" /></div>
            <div className="space-y-1"><Label htmlFor="station-city">City</Label><Input id="station-city" required value={stationDraft.city} onChange={(event) => setStationDraft({ ...stationDraft, city: event.target.value })} placeholder="Hanoi" /></div>
            <Button type="submit" disabled={stationCreate.isPending}>Add station</Button>
          </form>
          {stationCreate.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(stationCreate.error)}</p>}
          {stations.isError ? <p role="alert" className="text-sm text-destructive">{apiErrorMessage(stations.error)}</p> : <div className="flex flex-wrap gap-2">{stations.data?.map((station) => <span key={station.id} className="rounded-md bg-muted px-3 py-1 text-sm">{station.code} · {station.name}</span>)}</div>}
        </CardContent></Card>

        <Card id="new-trip"><CardHeader><CardTitle>Publish a train trip</CardTitle><p className="text-sm text-muted-foreground">Times use Vietnam time (UTC+07). All stops, seats and leg fares are saved together.</p></CardHeader><CardContent>
          <form className="space-y-6" onSubmit={submitTrip}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="train-number">Train number</Label><Input id="train-number" required placeholder="SE1" value={trainNumber} onChange={(event) => setTrainNumber(event.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="service-date">Service date</Label><Input id="service-date" type="date" required value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></div>
            </div>
            <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Stops</h2><Button type="button" variant="outline" size="sm" disabled={stops.length >= 50} onClick={() => { setStops([...stops, emptyStop()]); setFares({}); }}>Add stop</Button></div>
              {stops.map((stop, index) => <div key={index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1"><Label htmlFor={`stop-${index}`}>Stop {index + 1}</Label><select id={`stop-${index}`} required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={stop.station_id} onChange={(event) => { setStops(stops.map((item, i) => i === index ? { ...item, station_id: event.target.value } : item)); setFares({}); }}><option value="">Select station</option>{stations.data?.map((station) => <option key={station.id} value={station.id}>{station.code} · {station.name}</option>)}</select></div>
                <div className="space-y-1"><Label htmlFor={`arrival-${index}`}>Arrival {index === 0 && "(first stop)"}</Label><Input id={`arrival-${index}`} type="datetime-local" disabled={index === 0} required={index > 0} value={stop.arrival_at} onChange={(event) => setStops(stops.map((item, i) => i === index ? { ...item, arrival_at: event.target.value } : item))} /></div>
                <div className="space-y-1"><Label htmlFor={`departure-${index}`}>Departure {index === stops.length - 1 && "(last stop)"}</Label><Input id={`departure-${index}`} type="datetime-local" disabled={index === stops.length - 1} required={index < stops.length - 1} value={stop.departure_at} onChange={(event) => setStops(stops.map((item, i) => i === index ? { ...item, departure_at: event.target.value } : item))} /></div>
                <Button type="button" variant="outline" size="sm" disabled={stops.length <= 2} onClick={() => { setStops(stops.filter((_, i) => i !== index)); setFares({}); }}>Remove</Button>
              </div>)}
            </section>
            <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Coaches and seats</h2><Button type="button" variant="outline" size="sm" disabled={seats.length >= 30} onClick={() => setSeats([...seats, { coach_number: String(seats.length + 1), seat_type: "standard", seat_count: "72" }])}>Add coach</Button></div>
              {seats.map((seat, index) => <div key={index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1"><Label htmlFor={`coach-${index}`}>Coach</Label><Input id={`coach-${index}`} required value={seat.coach_number} onChange={(event) => setSeats(seats.map((item, i) => i === index ? { ...item, coach_number: event.target.value.toUpperCase() } : item))} /></div>
                <div className="space-y-1"><Label htmlFor={`type-${index}`}>Seat type</Label><select id={`type-${index}`} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={seat.seat_type} onChange={(event) => setSeats(seats.map((item, i) => i === index ? { ...item, seat_type: event.target.value as SeatDraft["seat_type"] } : item))}><option value="standard">Standard</option><option value="sleeper">Sleeper</option><option value="vip">VIP</option></select></div>
                <div className="space-y-1"><Label htmlFor={`count-${index}`}>Seats</Label><Input id={`count-${index}`} type="number" min="1" max="120" required value={seat.seat_count} onChange={(event) => setSeats(seats.map((item, i) => i === index ? { ...item, seat_count: event.target.value } : item))} /></div>
                <Button type="button" variant="outline" size="sm" disabled={seats.length <= 1} onClick={() => setSeats(seats.filter((_, i) => i !== index))}>Remove</Button>
              </div>)}
            </section>
            <section className="space-y-3"><h2 className="font-semibold">Fare per leg</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{stops.slice(0, -1).flatMap((stop, leg) => seatTypes.map((type) => <div key={`${leg}:${type}`} className="space-y-1"><Label htmlFor={`fare-${leg}-${type}`}>{stop.station_id || `Stop ${leg + 1}`} → {stops[leg + 1].station_id || `Stop ${leg + 2}`} · {type}</Label><Input id={`fare-${leg}-${type}`} type="number" min="1" step="1" required placeholder="VND" value={fares[`${leg}:${type}`] ?? ""} onChange={(event) => setFares({ ...fares, [`${leg}:${type}`]: event.target.value })} /></div>))}</div></section>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            {tripCreate.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(tripCreate.error)}</p>}
            {tripCreate.isSuccess && <p role="status" className="text-sm">Trip published.</p>}
            <Button type="submit" disabled={tripCreate.isPending || !stations.data?.length}>{tripCreate.isPending ? "Publishing…" : "Publish trip"}</Button>
          </form>
        </CardContent></Card>

        <Card id="trips"><CardHeader><CardTitle>Train trips</CardTitle></CardHeader><CardContent className="space-y-4">
          {trips.isError ? <p role="alert" className="text-destructive">{apiErrorMessage(trips.error)}</p> : trips.isPending ? <p>Loading trips…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-2">Train</th><th className="p-2">Date</th><th className="p-2">Stops</th><th className="p-2">Seats</th><th className="p-2">Status</th></tr></thead><tbody>{trips.data?.map((trip) => <tr key={trip.id} className="border-b border-border"><td className="p-2 font-medium">{trip.train_number}</td><td className="p-2">{trip.service_date}</td><td className="p-2">{trip.stop_count}</td><td className="p-2">{trip.seat_count}</td><td className="p-2">{trip.status}</td></tr>)}</tbody></table>{trips.data?.length === 0 && <p className="py-4 text-muted-foreground">No trips found.</p>}</div>}
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={tripOffset === 0} onClick={() => setTripOffset(Math.max(0, tripOffset - 20))}>Previous</Button><Button variant="outline" size="sm" disabled={(trips.data?.length ?? 0) < 20} onClick={() => setTripOffset(tripOffset + 20)}>Next</Button></div>
        </CardContent></Card>

        <Card id="bookings"><CardHeader><CardTitle>Bookings</CardTitle><p className="text-sm text-muted-foreground">Read only. Payment and ticket status remain governed by the existing workflow.</p></CardHeader><CardContent className="space-y-4">
          {bookings.isError ? <p role="alert" className="text-destructive">{apiErrorMessage(bookings.error)}</p> : bookings.isPending ? <p>Loading bookings…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-2">Booking</th><th className="p-2">Customer</th><th className="p-2">Train</th><th className="p-2">Date</th><th className="p-2">Fare</th><th className="p-2">Status</th></tr></thead><tbody>{bookings.data?.map((booking) => <tr key={booking.id} className="border-b border-border"><td className="p-2 font-mono text-xs">{booking.id.slice(0, 8)}</td><td className="p-2">{booking.customer_email || "—"}</td><td className="p-2">{booking.train_number}</td><td className="p-2">{booking.service_date}</td><td className="p-2">{booking.fare_vnd == null ? "—" : money(booking.fare_vnd)}</td><td className="p-2">{booking.status}</td></tr>)}</tbody></table>{bookings.data?.length === 0 && <p className="py-4 text-muted-foreground">No bookings found.</p>}</div>}
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={bookingOffset === 0} onClick={() => setBookingOffset(Math.max(0, bookingOffset - 20))}>Previous</Button><Button variant="outline" size="sm" disabled={(bookings.data?.length ?? 0) < 20} onClick={() => setBookingOffset(bookingOffset + 20)}>Next</Button></div>
        </CardContent></Card>
      </div>
    </main>
  );
}
