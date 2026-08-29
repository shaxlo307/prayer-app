/**
 * Reconciles the prayer list UI with the backend: loads today's existing
 * logs on app start, and decides whether a tap should POST (first mark of
 * the day) or PATCH (updating an already-logged prayer) against
 * /api/prayer-logs/.
 */

import { toISODate } from './calendar';
import { api, type Prayer, type PrayerLogEntry, type PrayerStatus } from './api';

export interface AuthCredentials {
  username: string;
  password: string;
}

/**
 * Formats a Date as the backend's expected YYYY-MM-DD.
 *
 * Re-exported from lib/calendar.ts's toISODate for backward compatibility
 * with existing callers/tests — kept as one implementation so a future fix
 * (e.g. to timezone handling) can't accidentally apply to only one copy.
 */
export const formatISODate = toISODate;

export type TodayLogsByPrayer = Partial<Record<Prayer, PrayerLogEntry>>;

/**
 * Fetches all prayer logs visible to this account and returns only today's,
 * keyed by prayer, so the UI can restore exact state (status + log id) on
 * app start — this is what makes marks persist across restarts.
 */
export async function loadTodayLogs(
  auth: AuthCredentials,
  date: Date = new Date()
): Promise<TodayLogsByPrayer> {
  const todayStr = formatISODate(date);
  const allLogs = await api.listPrayerLogs(auth);

  const byPrayer: TodayLogsByPrayer = {};
  for (const log of allLogs) {
    if (log.date === todayStr) {
      byPrayer[log.prayer] = log;
    }
  }
  return byPrayer;
}

export interface SyncPrayerStatusParams {
  profileId: number;
  date: Date;
  prayer: Prayer;
  status: PrayerStatus;
  /** Pass the existing log's id if one exists for this prayer today, else null. */
  existingLogId: number | null;
  auth: AuthCredentials;
}

/**
 * Creates a new log (first tap of the day for this prayer) or updates the
 * existing one (subsequent taps) — callers don't need to track which case
 * applies beyond passing the current `existingLogId`.
 */
export async function syncPrayerStatus({
  profileId,
  date,
  prayer,
  status,
  existingLogId,
  auth,
}: SyncPrayerStatusParams): Promise<PrayerLogEntry> {
  if (existingLogId !== null) {
    return api.updatePrayerLog(existingLogId, { status }, auth);
  }
  return api.createPrayerLog(
    { profile: profileId, date: formatISODate(date), prayer, status },
    auth
  );
}
