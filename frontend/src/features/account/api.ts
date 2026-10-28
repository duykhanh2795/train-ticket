import { apiClient } from "@/shared/api/client";

export interface SavedPassenger {
  id: string;
  full_name: string;
  created_at: string;
}

export async function listSavedPassengers(): Promise<SavedPassenger[]> {
  const response = await apiClient.get<{ passengers: SavedPassenger[] }>("/saved-passengers");
  return response.data.passengers;
}

export async function createSavedPassenger(fullName: string): Promise<SavedPassenger> {
  const response = await apiClient.post<SavedPassenger>("/saved-passengers", { full_name: fullName });
  return response.data;
}

export async function renameSavedPassenger(id: string, fullName: string): Promise<SavedPassenger> {
  const response = await apiClient.patch<SavedPassenger>(`/saved-passengers/${encodeURIComponent(id)}`, { full_name: fullName });
  return response.data;
}

export async function deleteSavedPassenger(id: string): Promise<void> {
  await apiClient.delete(`/saved-passengers/${encodeURIComponent(id)}`);
}
