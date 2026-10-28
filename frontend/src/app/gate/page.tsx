import type { Metadata } from "next";
import { GatePage } from "@/features/gate/gate-page";

export const metadata: Metadata = { title: "Gate check | Railway" };

export default function Page() {
  return <GatePage />;
}
