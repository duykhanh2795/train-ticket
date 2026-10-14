import { authorizedBackendProxy } from "@/shared/api/session";

export async function GET() {
  return authorizedBackendProxy("api/v1/auth/me");
}
