"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiErrorMessage } from "@/shared/api/client";
import { admitGateTicket, inspectGateTicket, type GateDecision, type GateTicket } from "./api";

const decisionText: Record<GateDecision, string> = {
  ready: "Ready for boarding",
  admitted: "Boarding confirmed",
  already_used: "Already used at the gate",
  trip_unavailable: "Booking or trip is unavailable",
  too_early: "Boarding has not opened",
  boarding_closed: "Boarding window has closed",
};

function gateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sign in with your gate agent account.";
    if (error.code === "gate_forbidden") return "This account has no gate assignment. Contact an operator.";
    if (error.code === "gate_ticket_not_found") return "No ticket was found for your assigned station.";
    if (error.code === "ticket_already_used") return "This ticket has already been used. Scan again to see its status.";
    if (error.code === "ticket_not_boardable") return "Boarding is not available. Scan again to see its status.";
  }
  return apiErrorMessage(error);
}

export function GatePage() {
  const [qrCode, setQrCode] = useState("");
  const [ticket, setTicket] = useState<GateTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function inspect() {
    if (!qrCode.trim() || busy) return;
    setBusy(true);
    setError(null);
    setTicket(null);
    try {
      setTicket(await inspectGateTicket(qrCode.trim()));
    } catch (cause) {
      setError(gateError(cause));
      setErrorStatus(cause instanceof ApiError ? cause.status : null);
    } finally {
      setBusy(false);
    }
  }

  async function admit() {
    if (ticket?.decision !== "ready" || busy) return;
    setBusy(true);
    setError(null);
    try {
      setTicket(await admitGateTicket(qrCode.trim()));
    } catch (cause) {
      setTicket(null);
      setError(gateError(cause));
      setErrorStatus(cause instanceof ApiError ? cause.status : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Railway staff</p>
            <h1 className="text-2xl font-semibold">Gate check</h1>
          </div>
          <Link href="/" className="text-sm underline underline-offset-4">Home</Link>
        </header>
        <Card>
          <CardHeader><CardTitle>Scan a ticket</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={(event) => { event.preventDefault(); void inspect(); }} className="space-y-3">
              <Label htmlFor="gate-qr">Ticket QR content</Label>
              <Input id="gate-qr" autoComplete="off" autoFocus value={qrCode}
                onChange={(event) => { setQrCode(event.target.value); setTicket(null); setError(null); }}
                placeholder="railway:ticket:v1:..." />
              <p className="text-sm text-muted-foreground">Use a handheld QR scanner or paste the QR content. Press Enter to inspect.</p>
              <Button type="submit" disabled={busy || !qrCode.trim()}>{busy ? "Checking…" : "Inspect ticket"}</Button>
            </form>
            {error && <Alert variant="destructive"><AlertDescription>{error} {errorStatus === 401 && <Link href="/login?return=gate" className="underline">Sign in</Link>}</AlertDescription></Alert>}
          </CardContent>
        </Card>
        {ticket && <Card>
          <CardHeader><CardTitle>{decisionText[ticket.decision]}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Passenger</dt><dd className="font-medium">{ticket.full_name}</dd></div>
              <div><dt className="text-muted-foreground">Train</dt><dd className="font-medium">{ticket.train_number}</dd></div>
              <div><dt className="text-muted-foreground">Coach / seat</dt><dd className="font-medium">{ticket.coach_number} / {ticket.seat_number}</dd></div>
              <div><dt className="text-muted-foreground">Boarding station</dt><dd className="font-medium">{ticket.boarding_station_id}</dd></div>
              <div><dt className="text-muted-foreground">Departure</dt><dd className="font-medium">{new Date(ticket.departure_at).toLocaleString()}</dd></div>
              {ticket.scanned_at && <div><dt className="text-muted-foreground">Checked in</dt><dd className="font-medium">{new Date(ticket.scanned_at).toLocaleString()}</dd></div>}
            </dl>
            {ticket.decision === "ready" && <Button type="button" onClick={() => void admit()} disabled={busy}>{busy ? "Confirming…" : "Confirm boarding"}</Button>}
          </CardContent>
        </Card>}
      </div>
    </main>
  );
}
