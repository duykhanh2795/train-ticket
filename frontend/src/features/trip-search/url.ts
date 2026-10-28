import type { TripSearchQuery } from "./types";

export function tripSearchHref(
  query: TripSearchQuery,
  options?: { departAfter?: string; passengers?: number },
) {
  const params = new URLSearchParams({
    origin: query.originId,
    destination: query.destinationId,
    date: query.serviceDate,
  });
  if (options?.departAfter && options.departAfter !== "00:00") {
    params.set("after", options.departAfter);
  }
  if (options?.passengers && options.passengers > 1) {
    params.set("pax", String(options.passengers));
  }
  return `/trains?${params.toString()}`;
}
