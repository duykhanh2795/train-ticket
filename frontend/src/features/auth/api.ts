import { apiClient } from "@/shared/api/client";
import type { AuthResponse, LoginInput, RegisterInput } from "./types";

export async function currentUser(): Promise<AuthResponse> {
  const response = await apiClient.get<AuthResponse>("/auth/me");
  return response.data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/login", input);
  return response.data;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register", input);
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}
