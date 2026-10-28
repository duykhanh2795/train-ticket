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
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    responseHeaders.set(
      "Content-Type",
      String(upstream.headers["content-type"] ?? "application/json"),
    );
    const requestId = upstream.headers["x-request-id"];
    if (typeof requestId === "string") {
      responseHeaders.set("X-Request-ID", requestId);
    }
    return new Response(
      [204, 205, 304].includes(upstream.status) ? null : upstream.data,
      {
        status: upstream.status,
        headers: responseHeaders,
      },
    );
  } catch (error) {
    const timedOut =
      axios.isAxiosError(error) &&
      (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT");
    return Response.json(
      {
        error: timedOut
          ? "The API took too long to respond. Please try again."
          : "Could not connect to the API. Please try again.",
        code: timedOut ? "backend_timeout" : "backend_unavailable",
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
