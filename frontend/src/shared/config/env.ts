import "server-only";
import { z } from "zod";

const serverEnvironmentSchema = z.object({
  BACKEND_API_URL: z.string().url(),
});

export function getBackendApiUrl(): string {
  const parsedEnvironment = serverEnvironmentSchema.parse({
    BACKEND_API_URL:
      process.env.BACKEND_API_URL ??
      (process.env.NODE_ENV === "production"
        ? undefined
        : "http://localhost:8080"),
  });
  return parsedEnvironment.BACKEND_API_URL.replace(/\/+$/, "");
}
