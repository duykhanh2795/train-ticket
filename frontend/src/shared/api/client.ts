import axios from "axios";

export const apiClient = axios.create({ baseURL: "/api", timeout: 15000 });

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof message === "string") return message;
    if (error.code === "ECONNABORTED")
      return "Yêu cầu quá thời gian. Vui lòng thử lại.";
  }
  return "Có lỗi xảy ra. Vui lòng thử lại.";
}
