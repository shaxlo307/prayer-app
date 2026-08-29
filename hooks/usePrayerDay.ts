import { useCallback, useEffect, useState } from 'react';

import type { Prayer, PrayerLogEntry, PrayerStatus } from '@/lib/api';
import { toISODate } from '@/lib/calendar';
import { loadTodayLogs, syncPrayerStatus, type TodayLogsByPrayer } from '@/lib/prayerLogSync';
import type { DeviceSession } from '@/lib/session';

const PRAYER_ORDER: Prayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const EMPTY_STATUSES: Record<Prayer, PrayerStatus> = {
  fajr: 'unmarked',
  dhuhr: 'unmarked',
  asr: 'unmarked',
  maghrib: 'unmarked',
  isha: 'unmarked',
};

export interface UsePrayerDayResult {
  statuses: Record<Prayer, PrayerStatus>;
  loading: boolean;
  loadError: string | null;
  syncError: string | null;
  pendingPrayers: Set<Prayer>;
  toggleDone: (prayer: Prayer) => void;
  markLate: (prayer: Prayer) => void;
  reload: () => Promise<void>;
}

/**
 * Loads and edits a single day's 5 prayer logs against the real backend —
 * shared by the home screen (today) and the day-detail screen (any past
 * date reached from the calendar), so both get identical persistence and
 * optimistic-update behavior instead of two copies of the same logic.
 */
export function usePrayerDay(date: Date, session: DeviceSession | null): UsePrayerDayResult {
  const [logs, setLogs] = useState<TodayLogsByPrayer>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingPrayers, setPendingPrayers] = useState<Set<Prayer>>(new Set());

  const dateKey = date.toDateString(); // stable dependency for effects below

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const fetched = await loadTodayLogs(
        { username: session.username, password: session.password },
        date
      );
      setLogs(fetched);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Could not load this day. Pull to retry.'
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, dateKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const changeStatus = useCallback(
    async (prayer: Prayer, nextStatus: PrayerStatus) => {
      if (!session || pendingPrayers.has(prayer)) return;

      const previousLog = logs[prayer];
      setSyncError(null);
      setPendingPrayers((prev) => new Set(prev).add(prayer));

      const optimisticLog: PrayerLogEntry = previousLog
        ? { ...previousLog, status: nextStatus }
        : {
            id: -1, // placeholder until the real id comes back
            profile: session.profileId,
            date: toISODate(date), // local-date-safe — NOT toISOString(), which is UTC
            prayer,
            status: nextStatus,
            created_at: '',
            updated_at: '',
          };
      setLogs((prev) => ({ ...prev, [prayer]: optimisticLog }));

      try {
        const saved = await syncPrayerStatus({
          profileId: session.profileId,
          date,
          prayer,
          status: nextStatus,
          existingLogId: previousLog?.id ?? null,
          auth: { username: session.username, password: session.password },
        });
        setLogs((prev) => ({ ...prev, [prayer]: saved }));
      } catch {
        setLogs((prev) => {
          const rolledBack = { ...prev };
          if (previousLog) {
            rolledBack[prayer] = previousLog;
          } else {
            delete rolledBack[prayer];
          }
          return rolledBack;
        });
        setSyncError(`Couldn't save ${prayer}. Check your connection and try again.`);
      } finally {
        setPendingPrayers((prev) => {
          const next = new Set(prev);
          next.delete(prayer);
          return next;
        });
      }
    },
    [date, logs, pendingPrayers, session]
  );

  const toggleDone = useCallback(
    (prayer: Prayer) => {
      const current = logs[prayer]?.status ?? 'unmarked';
      changeStatus(prayer, current === 'unmarked' ? 'done' : 'unmarked');
    },
    [changeStatus, logs]
  );

  const markLate = useCallback((prayer: Prayer) => changeStatus(prayer, 'late'), [changeStatus]);

  const statuses: Record<Prayer, PrayerStatus> = {
    ...EMPTY_STATUSES,
    ...Object.fromEntries(PRAYER_ORDER.map((p) => [p, logs[p]?.status ?? 'unmarked'])),
  };

  return { statuses, loading, loadError, syncError, pendingPrayers, toggleDone, markLate, reload };
}
