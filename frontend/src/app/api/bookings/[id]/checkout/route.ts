import {
  authorizedBackendProxy,
  requireSameOrigin,
} from "@/shared/api/session";

export async function POST(
  request: Request,
  context: RouteContext<"/api/bookings/[id]/checkout">,
) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await context.params;
  return authorizedBackendProxy(
    `api/v1/bookings/${encodeURIComponent(id)}/checkout`,
    { method: "POST" },
  );
}
