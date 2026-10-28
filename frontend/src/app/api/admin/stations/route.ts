import { authorizedBackendProxy, requireSameOrigin } from "@/shared/api/session";

export async function GET() {
  return authorizedBackendProxy("api/v1/admin/stations");
}

export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  return authorizedBackendProxy("api/v1/admin/stations", {
    method: "POST",
    body: await request.text(),
  });
}
