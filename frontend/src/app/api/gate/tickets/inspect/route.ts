import {
  authorizedBackendProxy,
  requireSameOrigin,
} from "@/shared/api/session";

export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  return authorizedBackendProxy("api/v1/gate/tickets/inspect", {
    method: "POST",
    body: await request.text(),
  });
}
