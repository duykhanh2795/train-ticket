import { createBrowserSession } from "@/shared/api/session";

export async function POST(request: Request) {
  return createBrowserSession(request, "login");
}
