import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MonthCalendar } from '@/components/prayer/MonthCalendar';
import { Brand } from '@/constants/theme';
import type { PrayerLogEntry } from '@/lib/api';
import { api } from '@/lib/api';
import { buildMonthGrid, groupLogsByDate, toISODate } from '@/lib/calendar';
import { getOrCreateSession, type DeviceSession } from '@/lib/session';

const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export default function HistoryScreen() {
  const router = useRouter();
  const [today] = useState(() => new Date());
  const [viewedYear, setViewedYear] = useState(today.getFullYear());
  const [viewedMonth, setViewedMonth] = useState(today.getMonth());

  const [session, setSession] = useState<DeviceSession | null>(null);
  const [logs, setLogs] = useState<PrayerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (activeSession: DeviceSession) => {
    try {
      const allLogs = await api.listPrayerLogs({
        username: activeSession.username,
        password: activeSession.password,
      });
      setLogs(allLogs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your history.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const newSession = await getOrCreateSession();
        setSession(newSession);
        await fetchLogs(newSession);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your history.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchLogs]);

  // Refetch whenever this screen regains focus — e.g. coming back from
  // editing a past day on the day-detail screen. Without this, the
  // calendar would keep showing stale completion colors for any day edited
  // during this visit, since the initial fetch only ran once on mount.
  useFocusEffect(
    useCallback(() => {
      if (session) {
        fetchLogs(session);
      }
      // Only re-run when focus is regained, not on every session/fetchLogs
      // identity change — those are covered by the mount effect above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session])
  );

  const logsByDate = useMemo(() => groupLogsByDate(logs), [logs]);

  const cells = useMemo(
    () => buildMonthGrid(viewedYear, viewedMonth, logsByDate, today),
    [viewedYear, viewedMonth, logsByDate, today]
  );

  const isCurrentMonth = viewedYear === today.getFullYear() && viewedMonth === today.getMonth();

  const goToPrevMonth = useCallback(() => {
    setViewedMonth((prevMonth) => {
      if (prevMonth === 0) {
        setViewedYear((y) => y - 1);
        return 11;
      }
      return prevMonth - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    if (isCurrentMonth) return; // don't navigate into the future
    setViewedMonth((prevMonth) => {
      if (prevMonth === 11) {
        setViewedYear((y) => y + 1);
        return 0;
      }
      return prevMonth + 1;
    });
  }, [isCurrentMonth]);

  const handleSelectDay = useCallback(
    (iso: string) => {
      // Today already has its own editing surface on the Home tab (with
      // its own usePrayerDay instance) — routing there too would create
      // two independent copies of today's state that don't sync with each
      // other. Route past days to the day-detail screen; today goes home.
      if (iso === toISODate(today)) {
        router.push('/');
        return;
      }
      router.push(`/day/${iso}`);
    },
    [router, today]
  );

  const monthLabel = MONTH_FORMATTER.format(new Date(viewedYear, viewedMonth, 1));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!session && loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Brand.muted} />
          <Text style={styles.statusText}>Loading your history…</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {session && (
        <MonthCalendar
          monthLabel={monthLabel}
          cells={cells}
          onSelectDay={handleSelectDay}
          onPrevMonth={goToPrevMonth}
          onNextMonth={isCurrentMonth ? undefined : goToNextMonth}
        />
      )}

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Brand.accent }]} />
          <Text style={styles.legendText}>All 5 prayers tracked</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, styles.legendDotPartial]} />
          <Text style={styles.legendText}>Some tracked</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, styles.legendDotNone]} />
          <Text style={styles.legendText}>None tracked</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  content: {
    padding: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 13,
    color: Brand.muted,
  },
  errorBanner: {
    backgroundColor: Brand.paperDeep,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  errorBannerText: {
    fontSize: 13,
    color: Brand.muted,
  },
  legend: {
    marginTop: 28,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendDotPartial: {
    borderWidth: 2,
    borderColor: Brand.accent,
  },
  legendDotNone: {
    borderWidth: 1,
    borderColor: Brand.neutralStroke,
  },
  legendText: {
    fontSize: 13,
    color: Brand.muted,
  },
});
