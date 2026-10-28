import type { Metadata } from "next";
import { CheckoutPage } from "@/features/booking/checkout-page";

export const metadata: Metadata = { title: "Review and pay | Railway" };
export const instant = false;

export default async function Page({ params }: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  return <CheckoutPage id={id} />;
}
