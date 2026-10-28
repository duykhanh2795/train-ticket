import { authorizedBackendProxy, requireSameOrigin } from "@/shared/api/session";

export async function GET() {
  return authorizedBackendProxy("api/v1/saved-passengers");
}

export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  return authorizedBackendProxy("api/v1/saved-passengers", {
    method: "POST",
    body: await request.text(),
  });
}
