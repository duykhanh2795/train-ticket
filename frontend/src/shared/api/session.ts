import "server-only";

import { cookies } from "next/headers";
import { backendProxy } from "./backend-proxy";

const COOKIE_NAME = "railway_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json(
      { error: "Invalid request", code: "invalid_origin" },
      { status: 403 },
    );
  }
  return null;
}

export async function createBrowserSession(
  request: Request,
  endpoint: "login" | "register",
) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  const upstream = await backendProxy(`api/v1/auth/${endpoint}`, {
    method: "POST",
    body: await request.text(),
  });
  if (!upstream.ok) return upstream;
  const data = (await upstream.json()) as {
    user: unknown;
    session_token: string;
  };
  if (!data.session_token || !data.user) {
    return Response.json(
      {
        error: "Invalid authentication response",
        code: "invalid_auth_response",
      },
      { status: 502 },
    );
  }
  (await cookies()).set(COOKIE_NAME, data.session_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return Response.json(
    { user: data.user },
    { status: upstream.status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function authorizedBackendProxy(path: string, init?: RequestInit) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token)
    return Response.json(
      { error: "Please sign in", code: "unauthenticated" },
      { status: 401 },
    );
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return backendProxy(path, { ...init, headers });
}

export async function clearBrowserSession() {
  (await cookies()).delete(COOKIE_NAME);
}
