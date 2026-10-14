import { backendProxy } from "@/shared/api/backend-proxy";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = new URLSearchParams({
    origin_id: params.get("origin_id") ?? "",
    destination_id: params.get("destination_id") ?? "",
    service_date: params.get("service_date") ?? "",
  });
  return backendProxy(`api/v1/trips/search?${query}`);
}
