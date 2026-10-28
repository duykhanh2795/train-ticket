import {
  authorizedBackendProxy,
  requireSameOrigin,
} from "@/shared/api/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  const { id } = await context.params;
  return authorizedBackendProxy(
    `api/v1/payments/${encodeURIComponent(id)}/mock/complete`,
    { method: "POST" },
  );
}
