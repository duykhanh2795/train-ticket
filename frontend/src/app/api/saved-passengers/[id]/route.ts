import { authorizedBackendProxy, requireSameOrigin } from "@/shared/api/session";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/saved-passengers/[id]">,
) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await context.params;
  return authorizedBackendProxy(`api/v1/saved-passengers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: await request.text(),
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/saved-passengers/[id]">,
) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await context.params;
  return authorizedBackendProxy(`api/v1/saved-passengers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
