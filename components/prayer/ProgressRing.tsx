import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Brand } from "@/constants/theme";

export interface ProgressRingProps {
  /** Number of prayers completed today (done + late both count as tracked). */
  completed: number;
  /** Total prayers in a day. Defaults to 5. */
  total?: number;
  /** Overrides the auto-generated encouraging subtext below the ring. */
  subtext?: string;
  size?: number;
  strokeWidth?: number;
}

function defaultSubtext(completed: number, total: number): string {
  if (completed <= 0) return "Let's mark your first prayer today.";
  if (completed >= total) return "All prayers tracked today — well done.";
  const remaining = total - completed;
  return `${remaining} more to go today.`;
}

/**
 * Circular progress ring showing the fraction of today's prayers tracked.
 *
 * Per the app spec's color rules: uses ONE accent color for the filled
 * portion (the "done" signal) and a neutral stroke for the remaining track
 * — never per-prayer colors, and never red/warning colors for the
 * remainder.
 */
export function ProgressRing({
  completed,
  total = 5,
  subtext,
  size = 168,
  strokeWidth = 14,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(Math.max(completed / total, 0), 1) : 0;
  const dashOffset = circumference * (1 - fraction);
  const center = size / 2;

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track (neutral, represents the remainder — never red) */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={Brand.neutralStroke}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Fill (single accent color represents "done") */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={Brand.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${center}, ${center}`}
          />
        </Svg>
        <View
          style={styles.centerLabel}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${completed} of ${total} prayers tracked today`}
          accessibilityValue={{ min: 0, max: total, now: completed }}
        >
          <Text style={styles.centerCount}>
            {completed}
            <Text style={styles.centerTotal}>/{total}</Text>
          </Text>
        </View>
      </View>

      <Text style={styles.trackedLabel}>
        {completed} of {total} tracked
      </Text>
      <Text style={styles.subtext}>
        {subtext ?? defaultSubtext(completed, total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  centerLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerCount: {
    fontSize: 34,
    fontWeight: "600",
    color: Brand.ink,
  },
  centerTotal: {
    fontSize: 18,
    fontWeight: "500",
    color: Brand.muted,
  },
  trackedLabel: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "600",
    color: Brand.ink,
  },
  subtext: {
    marginTop: 4,
    fontSize: 13,
    color: Brand.muted,
    textAlign: "center",
  },
});
