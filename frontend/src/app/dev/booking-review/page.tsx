import { notFound } from "next/navigation";
import { BookingReviewPreview } from "./preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BookingReviewPreview />;
}
