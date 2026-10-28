"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/shared/api/client";
import { completeMockPayment, getBooking, getPayment } from "./api";
import { BookingConfirmation } from "./booking-confirmation";

export function PaymentResult({ paymentID, mock = false }: { paymentID: string; mock?: boolean }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const validReference = /^[1-9][0-9]*$/.test(paymentID);
  const payment = useQuery({
    queryKey: ["payment", paymentID],
    queryFn: () => getPayment(paymentID),
    enabled: validReference,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 3000 : false,
  });
  const completion = useMutation({
    mutationFn: () => completeMockPayment(paymentID),
    onSuccess: (updated) => {
      queryClient.setQueryData(["payment", paymentID], updated);
      void queryClient.invalidateQueries({ queryKey: ["bookings", updated.booking_id] });
    },
  });
  const status = payment.data?.status;
  const confirmedBooking = useQuery({
    queryKey: ["bookings", payment.data?.booking_id],
    queryFn: () => getBooking(payment.data!.booking_id),
    enabled: status === "succeeded" && Boolean(payment.data?.booking_id),
    retry: false,
  });
  const holdExpired =
    payment.data?.status === "pending" &&
    now >= new Date(payment.data.expires_at).getTime();
  const title =
    status === "succeeded"
      ? "Payment successful"
      : status === "failed"
        ? "Payment failed"
        : status === "paid_unfulfilled"
          ? "Payment received, booking not fulfilled"
          : mock ? "Complete demo payment" : "Waiting for VNPAY confirmation";
  const description =
    status === "succeeded"
      ? "Your seats are confirmed. You can now view your booking."
      : status === "failed"
        ? "The payment failed. If your hold is still active, you can try again."
        : status === "paid_unfulfilled"
          ? mock ? "The hold expired or was cancelled. No ticket has been issued and no money was charged." : "The hold expired or was cancelled before payment was confirmed. Contact support to review the charge and arrange a refund. No ticket has been issued."
          : holdExpired
            ? mock ? "The hold has expired. Start a new booking to try again; no money was charged." : "The hold has expired. We are still waiting for payment confirmation. If you were charged, the payment will be flagged for a refund; no ticket will be issued."
            : mock ? "This is a development-only simulation. No real payment will be made." : "The VNPAY return page is not final confirmation. We are waiting for a verified notification and will update this page automatically.";

  if (status === "succeeded" && confirmedBooking.data?.status === "confirmed") {
    return mock ? (
      <>
        <div className="bg-amber-50 px-5 py-3 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Demo payment completed. No money was charged; this ticket is for development only.
        </div>
        <BookingConfirmation booking={confirmedBooking.data} />
      </>
    ) : <BookingConfirmation booking={confirmedBooking.data} />;
  }

  return (
    <main className="railway-landing min-h-screen bg-[#F0F3F7] px-4 py-12 text-foreground dark:bg-background">
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              {mock ? "Demo payment" : "VNPAY"}
            </Badge>
            <CardTitle>Payment status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!validReference && (
              <Alert>
                <AlertTitle>Missing payment reference</AlertTitle>
                <AlertDescription>
                  There is no payment reference to check. Open your bookings
                  instead.
                </AlertDescription>
              </Alert>
            )}
            {validReference && payment.isPending && (
              <Skeleton className="h-20 w-full" />
            )}
            {payment.isError && (
              <Alert>
                <AlertTitle>Unable to check payment status</AlertTitle>
                <AlertDescription>
                  {apiErrorMessage(payment.error)} Sign in with the account used
                  for this booking, then reload the page.
                </AlertDescription>
              </Alert>
            )}
            {payment.data && (
              <>
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold">{title}</h1>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <p className="text-sm">
                  Payment reference:{" "}
                  <span className="font-medium">{payment.data.payment_id}</span>
                </p>
                <p className="text-sm">
                  Amount:{" "}
                  <span className="font-medium">
                    {new Intl.NumberFormat("en-US").format(
                      payment.data.amount_vnd,
                    )}{" "}
                    ₫
                  </span>
                </p>
                {mock && status === "pending" && !holdExpired && (
                  <div className="space-y-2">
                    <Button disabled={completion.isPending} onClick={() => completion.mutate()}>
                      {completion.isPending ? "Confirming..." : "Complete demo payment"}
                    </Button>
                    {completion.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(completion.error)}</p>}
                    <p className="text-xs text-muted-foreground">No money will be charged.</p>
                  </div>
                )}
                <Link
                  href={`/bookings/${encodeURIComponent(payment.data.booking_id)}`}
                  className={buttonVariants()}
                >
                  View booking
                </Link>
              </>
            )}
            <div>
              <Link
                href="/bookings"
                className="text-sm underline underline-offset-4"
              >
                All bookings
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
