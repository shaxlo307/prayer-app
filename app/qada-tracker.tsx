import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { QadaProgressBar } from "@/components/prayer/QadaProgressBar";
import { Brand } from "@/constants/theme";
import { ApiError, api, type Prayer, type QadaDebtEntry } from "@/lib/api";
import { getOrCreateSession, type DeviceSession } from "@/lib/session";

const PRAYER_ORDER: Prayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const PRAYER_LABELS: Record<Prayer, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

type ScreenState =
  | { status: "loading" }
  | { status: "needs-setup" }
  | { status: "ready"; rows: Record<Prayer, QadaDebtEntry> }
  | { status: "error"; message: string };

/**
 * Day 15: qada tracker — one progress bar per prayer type, plus a combined
 * overall bar, connected to the real debt values from Day 14's backend
 * (`GET /api/qada-debt/`). If the profile hasn't been calculated yet (a
 * fresh qada setup with no QadaDebt rows), this screen triggers the
 * calculation itself via `calculateQadaDebt` rather than showing an empty
 * state — closing the setup-to-tracker loop in one visit.
 *
 * Day 16: each prayer row also has a "Log a qada [prayer]" button —
 * choosing which prayer type IS the action, per the spec ("choose which
 * prayer type, debt count decrements by 1"), so no separate picker is
 * needed. Logging updates that row's progress bar immediately from the
 * response's `debt` object, without waiting on a second fetch.
 */
export default function QadaTrackerScreen() {
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [loggingPrayer, setLoggingPrayer] = useState<Prayer | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const load = useCallback(async (activeSession: DeviceSession) => {
    try {
      const allDebt = await api.listQadaDebt({
        username: activeSession.username,
        password: activeSession.password,
      });
      let ownDebt = allDebt.filter((row) => row.profile === activeSession.profileId);

      if (ownDebt.length === 0) {
        // Nothing calculated yet for this profile — do it now rather than
        // showing an empty tracker, so completing qada setup and opening
        // the tracker "just works" in one flow.
        ownDebt = await api.calculateQadaDebt(
          activeSession.profileId,
          {},
          { username: activeSession.username, password: activeSession.password },
        );
      }

      const rows = Object.fromEntries(
        ownDebt.map((row) => [row.prayer, row]),
      ) as Record<Prayer, QadaDebtEntry>;
      setState({ status: "ready", rows });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setState({ status: "needs-setup" });
        return;
      }
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Could not load your qada tracker.",
      });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const activeSession = await getOrCreateSession();
        setSession(activeSession);
        await load(activeSession);
      } catch (err) {
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Could not connect your account. Pull to retry.",
        });
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    await load(session);
    setRefreshing(false);
  }, [session, load]);

  const handleLogPrayer = useCallback(
    async (prayer: Prayer) => {
      if (!session) return;
      setLogError(null);
      setLoggingPrayer(prayer);
      try {
        const result = await api.logQadaPrayer(session.profileId, prayer, {
          username: session.username,
          password: session.password,
        });
        // Update just this row from the response — no need to refetch
        // everything, and it lands on screen immediately.
        setState((prev) =>
          prev.status === "ready"
            ? { status: "ready", rows: { ...prev.rows, [prayer]: result.debt } }
            : prev,
        );
      } catch (err) {
        setLogError(
          err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body
            ? String((err.body as { detail: unknown }).detail)
            : err instanceof Error
              ? err.message
              : "Could not log that prayer.",
        );
      } finally {
        setLoggingPrayer(null);
      }
    },
    [session],
  );

  if (state.status === "loading") {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Brand.muted} />
          <Text style={styles.statusText}>Loading your qada tracker…</Text>
        </View>
      </View>
    );
  }

  if (state.status === "needs-setup") {
    return (
      <View style={styles.screen}>
        <View style={styles.centeredContent}>
          <Text style={styles.header}>Qada tracker</Text>
          <Text style={styles.subtext}>
            Finish qada setup first — we need your birth date, bulugh age,
            and practice-start date to work out your prayer count.
          </Text>
          <Link href="/qada-setup" style={styles.setupLink}>
            Go to qada setup →
          </Link>
        </View>
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={styles.screen}>
        <View style={styles.centeredContent}>
          <Text style={styles.header}>Qada tracker</Text>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{state.message}</Text>
          </View>
        </View>
      </View>
    );
  }

  const rows = PRAYER_ORDER.map((prayer) => state.rows[prayer]).filter(Boolean);
  const overallInitial = rows.reduce((sum, row) => sum + row.initial_count, 0);
  const overallRemaining = rows.reduce((sum, row) => sum + row.remaining_count, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.header}>Qada tracker</Text>
      <Text style={styles.subtext}>
        Your progress catching up on missed prayers — a forward path, not a
        tally to feel bad about.
      </Text>

      {logError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{logError}</Text>
        </View>
      )}

      <View style={styles.overallCard}>
        <QadaProgressBar
          label="Overall"
          initialCount={overallInitial}
          remainingCount={overallRemaining}
        />
      </View>

      <View style={styles.perPrayerCard}>
        {PRAYER_ORDER.map((prayer) => {
          const row = state.rows[prayer];
          if (!row) return null;
          return (
            <View key={prayer} style={styles.prayerBlock}>
              <QadaProgressBar
                label={PRAYER_LABELS[prayer]}
                initialCount={row.initial_count}
                remainingCount={row.remaining_count}
              />
              {row.remaining_count > 0 && (
                <Pressable
                  onPress={() => handleLogPrayer(prayer)}
                  disabled={loggingPrayer !== null}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.logButton,
                    pressed && styles.logButtonPressed,
                  ]}
                >
                  {loggingPrayer === prayer ? (
                    <ActivityIndicator size="small" color={Brand.accent} />
                  ) : (
                    <Text style={styles.logButtonText}>
                      Log a qada {PRAYER_LABELS[prayer]}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
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
  centeredContent: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
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
    padding: 24,
  },
  statusText: {
    fontSize: 13,
    color: Brand.muted,
  },
  errorBanner: {
    backgroundColor: Brand.paperDeep,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  errorBannerText: {
    fontSize: 13,
    color: Brand.muted,
  },
  setupLink: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "600",
    color: Brand.accent,
  },
  overallCard: {
    backgroundColor: Brand.paperDeep,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  perPrayerCard: {
    borderTopWidth: 1,
    borderTopColor: Brand.line,
    paddingTop: 20,
  },
  prayerBlock: {
    marginBottom: 4,
  },
  logButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.accent,
    marginBottom: 18,
  },
  logButtonPressed: {
    opacity: 0.7,
  },
  logButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Brand.accent,
  },
});
