import "server-only";

import axios from "axios";
import { getBackendApiUrl } from "@/shared/config/env";

export async function backendProxy(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    if (init?.body) headers.set("Content-Type", "application/json");
    const upstream = await axios.request<string>({
      url: new URL(path, `${getBackendApiUrl()}/`).toString(),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(headers),
      data: init?.body,
      timeout: 15_000,
      responseType: "text",
      transformResponse: (data) => data,
      validateStatus: () => true,
    });
    return new Response(upstream.data, {
      status: upstream.status,
      headers: {
        "Content-Type": String(upstream.headers["content-type"] ?? "application/json"),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "Không kết nối được API. Hãy khởi động backend Go rồi thử lại.",
        code: "backend_unavailable",
      },
      { status: 502 },
    );
  }
}
