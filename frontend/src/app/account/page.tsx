import type { Metadata } from "next";
import { AccountPage } from "@/features/account/account-page";

export const metadata: Metadata = { title: "Manage account | Railway" };

export default function Page() {
  return <AccountPage />;
}
