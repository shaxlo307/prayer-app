/**
 * TEMPORARY device-account session management.
 *
 * The roadmap doesn't build real sign-up/login until Day 19, but every
 * authenticated API call needs *some* identity before then. On first
 * launch, this silently registers a throwaway account (see the backend's
 * POST /api/register/) and stores the credentials + self-profile id in
 * SecureStore. Every subsequent launch reuses the stored session.
 *
 * This is scaffolding: Day 19 should introduce a real sign-up/login flow,
 * at which point this module either goes away or becomes the "guest
 * session" path alongside real accounts.
 */

import * as SecureStore from 'expo-secure-store';

import { api } from './api';

const USERNAME_KEY = 'device_session_username';
const PASSWORD_KEY = 'device_session_password';
const PROFILE_ID_KEY = 'device_session_profile_id';

export interface DeviceSession {
  username: string;
  password: string;
  profileId: number;
}

async function readStoredSession(): Promise<DeviceSession | null> {
  const [username, password, profileIdStr] = await Promise.all([
    SecureStore.getItemAsync(USERNAME_KEY),
    SecureStore.getItemAsync(PASSWORD_KEY),
    SecureStore.getItemAsync(PROFILE_ID_KEY),
  ]);

  if (!username || !password || !profileIdStr) {
    return null;
  }

  const profileId = parseInt(profileIdStr, 10);
  if (Number.isNaN(profileId)) {
    return null;
  }

  return { username, password, profileId };
}

async function storeSession(session: DeviceSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(USERNAME_KEY, session.username),
    SecureStore.setItemAsync(PASSWORD_KEY, session.password),
    SecureStore.setItemAsync(PROFILE_ID_KEY, String(session.profileId)),
  ]);
}

// Guards against a real race: multiple screens (home, history, day-detail)
// each call getOrCreateSession() independently on mount. On a brand-new
// install, if two of these fire close enough together, both could see "no
// stored session yet" and each register a separate throwaway account. This
// cache makes every concurrent caller within the same app process await
// the SAME in-flight promise instead of racing to create their own — the
// promise is assigned synchronously on the first call, before any `await`
// inside it can yield control, so no interleaving of concurrent callers
// can slip past the check.
let inFlightSessionPromise: Promise<DeviceSession> | null = null;

async function resolveSession(): Promise<DeviceSession> {
  const existing = await readStoredSession();
  if (existing) {
    return existing;
  }
  const registered = await api.registerDevice();
  const session: DeviceSession = {
    username: registered.username,
    password: registered.password,
    profileId: registered.profile.id,
  };
  await storeSession(session);
  return session;
}

/**
 * Returns the existing device session, or registers a new one if this is
 * the first launch. Safe to call every time the app starts, and safe to
 * call concurrently from multiple screens.
 */
export async function getOrCreateSession(): Promise<DeviceSession> {
  if (!inFlightSessionPromise) {
    inFlightSessionPromise = resolveSession().finally(() => {
      inFlightSessionPromise = null;
    });
  }
  return inFlightSessionPromise;
}
