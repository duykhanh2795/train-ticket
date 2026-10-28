import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentResult } from "@/features/booking/payment-result";

export const metadata: Metadata = { title: "Payment status | Railway" };

export default function Page({ searchParams }: PageProps<"/payment/result">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResultContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ResultContent({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const mock = params.mock === "1";
  const reference = mock ? params.payment_id : params.vnp_TxnRef;
  return (
    <PaymentResult paymentID={typeof reference === "string" ? reference : ""} mock={mock} />
  );
}
