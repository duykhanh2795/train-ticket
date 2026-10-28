import axios from "axios";

type ErrorPayload = {
  error?: unknown;
  code?: unknown;
  request_id?: unknown;
};

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly requestId: string | null;

  constructor(
    message: string,
    status: number | null,
    code: string,
    requestId: string | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function nonemptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!axios.isAxiosError(error)) {
    return new ApiError(
      "Something went wrong. Please try again.",
      null,
      "unknown_error",
      null,
    );
  }

  const status = error.response?.status ?? null;
  if (status !== null) {
    const data: ErrorPayload =
      error.response?.data &&
      typeof error.response.data === "object" &&
      !Array.isArray(error.response.data)
        ? (error.response.data as ErrorPayload)
        : {};
    const headers = error.response?.headers;
    const requestIdHeader =
      headers && typeof headers.get === "function"
        ? headers.get("x-request-id")
        : headers?.["x-request-id"];
    const requestId =
      nonemptyString(data.request_id) ?? nonemptyString(requestIdHeader);
    return new ApiError(
      nonemptyString(data.error) ??
        "Request could not be completed. Please try again.",
      status,
      nonemptyString(data.code) ?? "http_error",
      requestId,
    );
  }

  if (error.code === "ERR_CANCELED") {
    return new ApiError("Request cancelled.", null, "request_cancelled", null);
  }
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new ApiError(
      "The request timed out. Please try again.",
      null,
      "request_timeout",
      null,
    );
  }
  return new ApiError(
    "Could not connect. Check your connection and try again.",
    null,
    "network_error",
    null,
  );
}

export const apiClient = axios.create({ baseURL: "/api", timeout: 15000 });

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeApiError(error)),
);

export function apiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}
