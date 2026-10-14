import {
  authorizedBackendProxy,
  requireSameOrigin,
} from "@/shared/api/session";

export async function POST(
  request: Request,
  context: RouteContext<"/api/bookings/[id]/confirm">,
) {
  const { id } = await context.params;
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  return authorizedBackendProxy(
    `api/v1/bookings/${encodeURIComponent(id)}/confirm`,
    {
      method: "POST",
    },
  );
}
