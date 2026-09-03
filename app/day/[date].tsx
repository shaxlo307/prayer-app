import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PrayerRow } from "@/components/prayer/PrayerRow";
import { Brand } from "@/constants/theme";
import { usePrayerDay } from "@/hooks/usePrayerDay";
import type { Prayer } from "@/lib/api";
import { parseISODate } from "@/lib/calendar";
import { getOrCreateSession, type DeviceSession } from "@/lib/session";

const PRAYER_ORDER: Prayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export default function DayDetailScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date: string }>();
  // Memoized so `date`'s object identity is stable across re-renders as
  // long as the route param itself hasn't changed — usePrayerDay and its
  // callbacks depend on this reference, and recreating it every render
  // would churn their identities for no reason.
  const date = useMemo(() => parseISODate(dateParam), [dateParam]);

  // Guard: invalid date string or future date → redirect to home.
  // MonthCalendar disables future taps but deep links bypass that check.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const isInvalid = isNaN(date.getTime());
  const isFuture = !isInvalid && date > today;

  const [session, setSession] = useState<DeviceSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setSession(await getOrCreateSession());
      } catch (err) {
        setSessionError(
          err instanceof Error
            ? err.message
            : "Could not connect your account.",
        );
      }
    })();
  }, []);

  const { statuses, loading, loadError, syncError, toggleDone, markLate } =
    usePrayerDay(date, session);

  if (isInvalid || isFuture) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <Text style={styles.dateHeader}>{DATE_FORMATTER.format(date)}</Text>
      <Text style={styles.subtext}>
        Editing this day updates your record — useful for backfilling a day you
        forgot to log.
      </Text>

      {(sessionError || loadError || syncError) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            {sessionError ?? loadError ?? syncError}
          </Text>
        </View>
      )}

      {loading && !sessionError ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Brand.muted} />
          <Text style={styles.statusText}>Loading this day…</Text>
        </View>
      ) : (
        <View style={styles.prayerShell}>
          {PRAYER_ORDER.map((prayer) => (
            <PrayerRow
              key={prayer}
              prayer={prayer}
              status={statuses[prayer]}
              onPress={() => toggleDone(prayer)}
              onLongPress={() => markLate(prayer)}
            />
          ))}
        </View>
      )}
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
  dateHeader: {
    fontSize: 24,
    fontWeight: "600",
    color: Brand.ink,
    marginBottom: 6,
  },
  subtext: {
    fontSize: 13,
    color: Brand.muted,
    marginBottom: 24,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
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
  prayerShell: {
    borderTopWidth: 1,
    borderTopColor: Brand.line,
  },
});
