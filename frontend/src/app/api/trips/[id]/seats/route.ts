import { backendProxy } from "@/shared/api/backend-proxy";

export async function GET(
  request: Request,
  context: RouteContext<"/api/trips/[id]/seats">,
) {
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const query = new URLSearchParams({
    from_stop: params.get("from_stop") ?? "",
    to_stop: params.get("to_stop") ?? "",
  });
  return backendProxy(`api/v1/trips/${encodeURIComponent(id)}/seats?${query}`);
}
