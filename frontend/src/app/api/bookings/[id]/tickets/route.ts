import { authorizedBackendProxy } from "@/shared/api/session";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/bookings/[id]/tickets">,
) {
  const { id } = await context.params;
  return authorizedBackendProxy(
    `api/v1/bookings/${encodeURIComponent(id)}/tickets`,
  );
}
