import { authorizedBackendProxy } from "@/shared/api/session";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/payments/[id]">,
) {
  const { id } = await context.params;
  return authorizedBackendProxy(`api/v1/payments/${encodeURIComponent(id)}`);
}
