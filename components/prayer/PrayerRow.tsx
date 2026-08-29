import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import type { Prayer, PrayerStatus } from '@/lib/api';

const PRAYER_LABELS: Record<Prayer, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export interface PrayerRowProps {
  prayer: Prayer;
  /** Pre-formatted display time for this prayer today, e.g. "5:12 AM". Omit
   * entirely (e.g. on the day-detail/history view) rather than passing an
   * empty string, so the row doesn't reserve dead space for it. */
  time?: string;
  status: PrayerStatus;
  /**
   * Only set this for the current/next prayer — per the spec, badges
   * should not appear on every row, to avoid visual noise.
   */
  badge?: string;
  notificationsEnabled?: boolean;
  onToggleNotification?: () => void;
  /** Tap cycles unmarked <-> done. */
  onPress?: () => void;
  /** Long-press marks the prayer as late (kept as a secondary gesture). */
  onLongPress?: () => void;
}

/**
 * One row in the prayer list. Per the spec: a single tap target (no
 * separate view/mark buttons), one accent color for "done", no red/danger
 * styling for unmarked or late — late is distinguished by icon, not color.
 */
export function PrayerRow({
  prayer,
  time,
  status,
  badge,
  notificationsEnabled = true,
  onToggleNotification,
  onPress,
  onLongPress,
}: PrayerRowProps) {
  const isDone = status === 'done';
  const isLate = status === 'late';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${PRAYER_LABELS[prayer]}${time ? `, ${time}` : ''}, ${status}`}
      accessibilityHint="Double tap to mark done or not done. Long press to mark as prayed late."
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {/* Tap-circle: empty ring / filled check / late marker — single accent color throughout */}
      <View style={styles.tapCircle}>
        {isDone && <Ionicons name="checkmark-circle" size={30} color={Brand.accent} />}
        {isLate && <Ionicons name="time" size={30} color={Brand.accent} />}
        {!isDone && !isLate && (
          <Ionicons name="ellipse-outline" size={28} color={Brand.neutralStroke} />
        )}
      </View>

      {/* Prayer name */}
      <Text style={styles.name}>{PRAYER_LABELS[prayer]}</Text>

      <View style={styles.rightGroup}>
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {time && <Text style={styles.time}>{time}</Text>}
        <Pressable
          onPress={onToggleNotification}
          hitSlop={8}
          disabled={!onToggleNotification}
          accessibilityRole="button"
          accessibilityLabel={
            notificationsEnabled
              ? `Notifications on for ${PRAYER_LABELS[prayer]}`
              : `Notifications off for ${PRAYER_LABELS[prayer]}`
          }>
          <Ionicons
            name={notificationsEnabled ? 'notifications' : 'notifications-off-outline'}
            size={18}
            color={Brand.muted}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
  },
  rowPressed: {
    backgroundColor: Brand.paperDeep,
  },
  tapCircle: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: Brand.ink,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Brand.paperDeep,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  time: {
    fontSize: 14,
    color: Brand.muted,
    minWidth: 64,
    textAlign: 'right',
  },
});
