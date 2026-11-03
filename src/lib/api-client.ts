import type { EpisodeDTO, SettingsDTO } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, credentials: "same-origin", headers });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Session expired");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const api = {
  listEpisodes: () => request<{ episodes: EpisodeDTO[] }>("/api/episodes"),
  addEpisode: (url: string) =>
    request<{ status: string; message: string; episode: EpisodeDTO }>("/api/episodes", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  updateEpisode: (id: string, patch: { title?: string; description?: string }) =>
    request<{ episode: EpisodeDTO }>(`/api/episodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteEpisode: (id: string) => request<void>(`/api/episodes/${id}`, { method: "DELETE" }),
  retryEpisode: (id: string) =>
    request<{ episode: EpisodeDTO }>(`/api/episodes/${id}/retry`, { method: "POST" }),
  getSettings: () => request<{ settings: SettingsDTO }>("/api/settings"),
  updateSettings: (patch: Pick<SettingsDTO, "feedTitle" | "feedDescription" | "feedAuthor">) =>
    request<{ settings: SettingsDTO }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  rotate: (target: "api" | "feed") =>
    request<{ settings: SettingsDTO; apiToken?: string }>("/api/settings/rotate", {
      method: "POST",
      body: JSON.stringify({ target }),
    }),
  login: (password: string) =>
    request<{ ok: true }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};
