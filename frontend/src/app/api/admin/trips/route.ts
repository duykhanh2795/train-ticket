import { authorizedBackendProxy, requireSameOrigin } from "@/shared/api/session";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const params = new URLSearchParams({
    limit: query.get("limit") ?? "20",
    offset: query.get("offset") ?? "0",
  });
  return authorizedBackendProxy(`api/v1/admin/trips?${params}`);
}

export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  return authorizedBackendProxy("api/v1/admin/trips", {
    method: "POST",
    body: await request.text(),
  });
}
