import {
  authorizedBackendProxy,
  clearBrowserSession,
  requireSameOrigin,
} from "@/shared/api/session";

export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  const upstream = await authorizedBackendProxy("api/v1/auth/logout", {
    method: "POST",
  });
  await clearBrowserSession();
  return upstream;
}
