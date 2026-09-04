import { StyleSheet, Text, View } from "react-native";

import { Brand } from "@/constants/theme";

export interface QadaProgressBarProps {
  /** Display label for this bar — a prayer name, or "Overall" for the
   * combined bar. Not typed as `Prayer` since the overall bar isn't one. */
  label: string;
  /** Fixed baseline (see QadaDebtEntry.initial_count) — what the debt was
   * when first calculated, not decremented by logging. */
  initialCount: number;
  /** Current remaining debt, decremented as qada prayers are logged. */
  remainingCount: number;
}

function completedFraction(initialCount: number, remainingCount: number): number {
  // No debt was ever owed for this prayer — treat as fully "caught up"
  // rather than dividing by zero.
  if (initialCount <= 0) return 1;
  const completed = initialCount - remainingCount;
  return Math.min(Math.max(completed / initialCount, 0), 1);
}

/**
 * One horizontal progress bar for the qada tracker (spec: "Progress bar
 * per prayer type + one combined overall progress bar"). Per the app's
 * color rules: a single accent color for the filled/"done" portion, a
 * neutral track for the remainder — never a second color, never
 * red/warning styling for outstanding debt (the spec's "forward path, not
 * a shame counter" framing).
 */
export function QadaProgressBar({
  label,
  initialCount,
  remainingCount,
}: QadaProgressBarProps) {
  const fraction = completedFraction(initialCount, remainingCount);
  const percent = Math.round(fraction * 100);
  const completed = Math.max(initialCount - remainingCount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.name}>{label}</Text>
        <Text style={styles.count}>
          {remainingCount === 0
            ? "All caught up"
            : `${remainingCount.toLocaleString()} remaining`}
        </Text>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${label} qada progress`}
        accessibilityValue={{ min: 0, max: initialCount, now: completed }}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: Brand.ink,
  },
  count: {
    fontSize: 13,
    color: Brand.muted,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.neutralStroke,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: Brand.accent,
  },
});
