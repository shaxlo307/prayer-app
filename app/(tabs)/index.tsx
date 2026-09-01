import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  LocationSetupBanner,
  type LocationSource,
} from "@/components/prayer/LocationSetupBanner";
import { PrayerRow } from "@/components/prayer/PrayerRow";
import { ProgressRing } from "@/components/prayer/ProgressRing";
import { Brand } from "@/constants/theme";
import { usePrayerDay } from "@/hooks/usePrayerDay";
import type { Madhhab, Prayer } from "@/lib/api";
import { api } from "@/lib/api";
import {
  fetchPrayerTimesByCity,
  fetchPrayerTimesByCoords,
  formatPrayerTime,
  type DailyPrayerTimes,
} from "@/lib/prayerTimes";
import { getOrCreateSession, type DeviceSession } from "@/lib/session";

const PRAYER_ORDER: Prayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PLACEHOLDER_TIME = "--:--";

/**
 * Returns the index of the current or next prayer based on the device clock.
 * - During a prayer's window (its time → next prayer's time): that prayer
 * - Before Fajr: 0 (Fajr is next)
 * - After Isha: null (all prayers done for today, no badge shown)
 */
function getCurrentPrayerIndex(times: DailyPrayerTimes): number | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Convert each "HH:MM" (24h) string to minutes-since-midnight
  const prayerMinutes = PRAYER_ORDER.map((prayer) => {
    const [h, m] = times[prayer].split(":").map(Number);
    return h * 60 + m;
  });

  // Walk backwards: find the last prayer whose start time we've passed
  for (let i = prayerMinutes.length - 1; i >= 0; i--) {
    if (nowMinutes >= prayerMinutes[i]) {
      // Past Isha — all done for today, no badge
      if (i === prayerMinutes.length - 1) return null;
      // Still within this prayer's window
      return i;
    }
  }

  // Before Fajr — Fajr is the next prayer
  return 0;
}

// Until onboarding/auth exists (a later day), madhhab + calculation method
// use the same defaults as the Profile model rather than a saved profile.
const DEFAULT_MADHHAB: Madhhab = "hanafi";
const DEFAULT_CALCULATION_METHOD = 2;

function formatDateHeader(date: Date): { weekday: string; full: string } {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const full = date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return { weekday, full };
}

type ConnectionState = "checking" | "connected" | "unreachable";
type PrayerTimesState =
  | { status: "unresolved" } // no location set yet
  | { status: "loading" }
  | { status: "loaded"; times: DailyPrayerTimes }
  | { status: "error"; message: string };

export default function SoloHomeScreen() {
  // Today's date, pulled from the device — never hardcoded.
  const [today, setToday] = useState(() => new Date());
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [refreshing, setRefreshing] = useState(false);

  const [location, setLocation] = useState<LocationSource | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesState>({
    status: "unresolved",
  });

  // Device session (see lib/session.ts — temporary stand-in for real
  // sign-up/login, which doesn't exist until a later day).
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Shared with the day-detail screen (app/day/[date].tsx) reached from
  // the calendar — same load/tap/persist logic, just a different date.
  const { statuses, loadError, syncError, toggleDone, markLate, reload } =
    usePrayerDay(today, session);

  const checkConnection = useCallback(async () => {
    try {
      const result = await api.health();
      setConnection(result.status === "ok" ? "connected" : "unreachable");
    } catch {
      setConnection("unreachable");
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    (async () => {
      try {
        setSession(await getOrCreateSession());
      } catch (err) {
        setSessionError(
          err instanceof Error
            ? err.message
            : "Could not connect your account. Pull to retry.",
        );
      }
    })();
  }, []);

  const loadPrayerTimes = useCallback(async (source: LocationSource) => {
    setPrayerTimes({ status: "loading" });
    try {
      const times =
        source.type === "coords"
          ? await fetchPrayerTimesByCoords({
              latitude: source.coords.latitude,
              longitude: source.coords.longitude,
              calculationMethod: DEFAULT_CALCULATION_METHOD,
              madhhab: DEFAULT_MADHHAB,
            })
          : await fetchPrayerTimesByCity({
              city: source.city,
              country: source.country,
              calculationMethod: DEFAULT_CALCULATION_METHOD,
              madhhab: DEFAULT_MADHHAB,
            });
      setPrayerTimes({ status: "loaded", times });
    } catch (err) {
      setPrayerTimes({
        status: "error",
        message:
          err instanceof Error ? err.message : "Could not load prayer times.",
      });
    }
  }, []);

  const handleLocationResolved = useCallback(
    (source: LocationSource) => {
      setLocation(source);
      loadPrayerTimes(source);
    },
    [loadPrayerTimes],
  );

  // Reset `today` when the app returns to the foreground after midnight.
  // Without this, prayer times and logs stay pinned to the launch date
  // for the lifetime of the process — even across day boundaries.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const now = new Date();
        // Only update if the calendar date has actually changed —
        // avoids unnecessary re-renders on every foreground resume.
        if (now.toDateString() !== today.toDateString()) {
          setToday(now);
          // Prayer times must be re-fetched for the new day.
          // location is already in state — just re-trigger the load.
          if (location) {
            loadPrayerTimes(location);
          }
        }
      }
    });
    return () => sub.remove();
  }, [today, location, loadPrayerTimes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkConnection();
    if (location) {
      await loadPrayerTimes(location);
    }
    await reload();
    setRefreshing(false);
  }, [checkConnection, loadPrayerTimes, location, reload]);

  const timeFor = (prayer: Prayer): string => {
    if (prayerTimes.status === "loaded") {
      return formatPrayerTime(prayerTimes.times[prayer]);
    }
    return PLACEHOLDER_TIME;
  };

  const trackedCount = PRAYER_ORDER.filter(
    (p) => statuses[p] !== "unmarked",
  ).length;
  const { weekday, full } = formatDateHeader(today);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* ---- Date header ---- */}
      <View style={styles.dateHeader}>
        <Text style={styles.eyebrow}>today</Text>
        <Text style={styles.weekday}>{weekday}</Text>
        <Text style={styles.fullDate}>{full}</Text>
      </View>

      {/* ---- Connection status (proves live API loading, not hardcoded data) ---- */}
      <View style={styles.statusRow}>
        {connection === "checking" && (
          <>
            <ActivityIndicator size="small" color={Brand.muted} />
            <Text style={styles.statusText}>Connecting to server…</Text>
          </>
        )}
        {connection === "connected" && (
          <>
            <View
              style={[styles.statusDot, { backgroundColor: Brand.accent }]}
            />
            <Text style={styles.statusText}>Connected to live API</Text>
          </>
        )}
        {connection === "unreachable" && (
          <>
            <View
              style={[styles.statusDot, { backgroundColor: Brand.muted }]}
            />
            <Text style={styles.statusText}>
              Server unreachable — pull to retry
            </Text>
          </>
        )}
      </View>

      {sessionError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{sessionError}</Text>
        </View>
      )}
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError}</Text>
        </View>
      )}
      {syncError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{syncError}</Text>
        </View>
      )}

      {/* ---- Location banner: non-blocking per the spec's edge-case rules ---- */}
      {!location && (
        <LocationSetupBanner onLocationResolved={handleLocationResolved} />
      )}
      {prayerTimes.status === "error" && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{prayerTimes.message}</Text>
        </View>
      )}
      {prayerTimes.status === "loading" && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Brand.muted} />
          <Text style={styles.statusText}>
            Calculating today&apos;s prayer times…
          </Text>
        </View>
      )}

      {/* ---- Progress summary card ---- */}
      <View style={styles.ringCard}>
        <ProgressRing completed={trackedCount} total={PRAYER_ORDER.length} />
      </View>

      {/* ---- Prayer list ---- */}
      <View style={styles.prayerShell}>
        {PRAYER_ORDER.map((prayer, index) => (
          <PrayerRow
            key={prayer}
            prayer={prayer}
            time={timeFor(prayer)}
            status={statuses[prayer]}
            badge={
              prayerTimes.status === "loaded" &&
              getCurrentPrayerIndex(prayerTimes.times) === index
                ? "Now"
                : undefined
            }
            onPress={() => toggleDone(prayer)}
            onLongPress={() => markLate(prayer)}
          />
        ))}
      </View>

      {/* ---- Link to calendar/history view ---- */}
      <Link href="/history" style={styles.historyLink}>
        View calendar →
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
  },
  dateHeader: {
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: Brand.accent,
    marginBottom: 8,
    fontWeight: "600",
  },
  weekday: {
    fontSize: 34,
    fontWeight: "600",
    color: Brand.ink,
    marginBottom: 4,
  },
  fullDate: {
    fontSize: 15,
    color: Brand.muted,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Brand.paperDeep,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: Brand.muted,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
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
  ringCard: {
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 8,
  },
  prayerShell: {
    borderTopWidth: 1,
    borderTopColor: Brand.line,
  },
  historyLink: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: Brand.accent,
  },
});
