/**
 * Minimal API client for the Django backend, reconciled against the app
 * spec on Day 7.5. `Profile.type` replaces the old self-referential
 * `parent` field — all profiles in a family share one `user` account.
 * `PrayerLogEntry.status` replaces the old `completed` boolean.
 */

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type Prayer = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export type PrayerStatus = "unmarked" | "done" | "late";
export type ProfileType = "self" | "child";
export type Madhhab = "hanafi" | "shafi";

export interface Profile {
  id: number;
  username: string;
  type: ProfileType;
  display_name: string;
  age: number | null;
  qada_enabled: boolean;
  birth_date: string | null;
  gender: "male" | "female" | null;
  bulugh_age: number | null;
  practice_start_date: string | null;
  madhhab: Madhhab;
  calculation_method: number;
  latitude: number | null;
  longitude: number | null;
  city: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface PrayerLogEntry {
  id: number;
  profile: number;
  date: string; // YYYY-MM-DD
  prayer: Prayer;
  status: PrayerStatus;
  created_at: string;
  updated_at: string;
}

export interface QadaDebtEntry {
  id: number;
  profile: number;
  prayer: Prayer;
  /** Fixed baseline computed at calculation time — used to derive percent
   * complete (`initial_count - remaining_count`), since remaining_count
   * alone can't show "how far along" once Day 16 starts decrementing it. */
  initial_count: number;
  remaining_count: number;
  updated_at: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  /** Basic auth credentials until token auth is wired up (see Day 6 note). */
  auth?: { username: string; password: string };
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.auth) {
    const encoded = btoa(`${options.auth.username}:${options.auth.password}`);
    headers["Authorization"] = `Basic ${encoded}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(0, "Request timed out after 10 seconds");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}

export interface RegisterDeviceResponse {
  username: string;
  password: string;
  profile: Profile;
}

export const api = {
  health: () => request<{ status: string; database: string }>("/api/health/"),

  /**
   * TEMPORARY device-account bootstrap (see backend core/views.py for
   * rationale) — creates a throwaway account + self profile. Called once
   * per install by lib/session.ts, not directly by screens.
   */
  registerDevice: () =>
    request<RegisterDeviceResponse>("/api/register/", { method: "POST" }),

  listProfiles: (auth: RequestOptions["auth"]) =>
    request<Profile[]>("/api/profiles/", { auth }),

  createProfile: (
    body: Pick<Profile, "display_name"> & Partial<Profile>,
    auth: RequestOptions["auth"],
  ) => request<Profile>("/api/profiles/", { method: "POST", body, auth }),

  /**
   * Day 13: qada setup (birth date, bulugh age, gender, practice start
   * date) is saved via PATCH against the existing self profile — no new
   * backend schema needed, these fields already existed on Profile since
   * the Day 7.5 reconciliation.
   */
  updateProfile: (
    id: number,
    body: Partial<Profile>,
    auth: RequestOptions["auth"],
  ) =>
    request<Profile>(`/api/profiles/${id}/`, {
      method: "PATCH",
      body,
      auth,
    }),

  /**
   * Day 14/15: reads the current qada debt across all of this account's
   * profiles (self + any children, once family mode has UI) — the qada
   * tracker screen filters client-side to the profile it's showing.
   */
  listQadaDebt: (auth: RequestOptions["auth"]) =>
    request<QadaDebtEntry[]>("/api/qada-debt/", { auth }),

  /**
   * Day 14: computes (and stores) the initial qada debt for a profile
   * from its qada-setup fields. Idempotent by default — a second call
   * returns the existing rows unchanged (protects Day 16's future logged
   * progress); pass `{ force: true }` to explicitly recompute.
   */
  calculateQadaDebt: (
    profileId: number,
    options: { force?: boolean },
    auth: RequestOptions["auth"],
  ) =>
    request<QadaDebtEntry[]>(`/api/profiles/${profileId}/calculate-qada-debt/`, {
      method: "POST",
      body: options.force ? { force: true } : undefined,
      auth,
    }),

  listPrayerLogs: (auth: RequestOptions["auth"]) =>
    request<PrayerLogEntry[]>("/api/prayer-logs/", { auth }),

  createPrayerLog: (
    body: {
      profile: number;
      date: string;
      prayer: Prayer;
      status?: PrayerStatus;
    },
    auth: RequestOptions["auth"],
  ) =>
    request<PrayerLogEntry>("/api/prayer-logs/", {
      method: "POST",
      body,
      auth,
    }),

  updatePrayerLog: (
    id: number,
    body: Partial<Pick<PrayerLogEntry, "status">>,
    auth: RequestOptions["auth"],
  ) =>
    request<PrayerLogEntry>(`/api/prayer-logs/${id}/`, {
      method: "PATCH",
      body,
      auth,
    }),
};
