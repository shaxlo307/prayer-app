import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import type { CalendarCell } from '@/lib/calendar';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface MonthCalendarProps {
  monthLabel: string; // e.g. "August 2026"
  cells: CalendarCell[];
  selectedIso?: string | null;
  onSelectDay: (iso: string) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

/**
 * Month grid colored by completion, per the spec: one accent color for
 * "all done", a lighter accent ring for partial, neutral for none/future.
 * No red/danger anywhere. Future days are visible but not tappable.
 */
export function MonthCalendar({
  monthLabel,
  cells,
  selectedIso,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onPrevMonth}
          disabled={!onPrevMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month">
          <Text style={[styles.navArrow, !onPrevMonth && styles.navArrowDisabled]}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable
          onPress={onNextMonth}
          disabled={!onNextMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month">
          <Text style={[styles.navArrow, !onNextMonth && styles.navArrowDisabled]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, index) => {
          if (cell.date === null || cell.iso === null) {
            return <View key={`blank-${index}`} style={styles.cell} />;
          }

          const isFuture = cell.completion === 'future';
          const isSelected = cell.iso === selectedIso;

          return (
            <Pressable
              key={cell.iso}
              disabled={isFuture}
              onPress={() => onSelectDay(cell.iso!)}
              accessibilityRole="button"
              accessibilityLabel={`${cell.iso}, ${cell.completion}`}
              accessibilityState={{ disabled: isFuture, selected: isSelected }}
              style={styles.cell}>
              <View
                style={[
                  styles.dayCircle,
                  cell.completion === 'all' && styles.dayAllDone,
                  cell.completion === 'partial' && styles.dayPartial,
                  cell.completion === 'none' && styles.dayNone,
                  isFuture && styles.dayFuture,
                  isSelected && styles.daySelected,
                ]}>
                <Text
                  style={[
                    styles.dayNumber,
                    cell.completion === 'all' && styles.dayNumberOnAccent,
                    isFuture && styles.dayNumberFuture,
                  ]}>
                  {cell.dayOfMonth}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
  },
  navArrow: {
    fontSize: 24,
    color: Brand.ink,
    paddingHorizontal: 12,
  },
  navArrowDisabled: {
    color: Brand.neutralStroke,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: Brand.muted,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayAllDone: {
    backgroundColor: Brand.accent,
  },
  dayPartial: {
    borderWidth: 2,
    borderColor: Brand.accent,
  },
  dayNone: {
    borderWidth: 1,
    borderColor: Brand.neutralStroke,
  },
  dayFuture: {
    borderWidth: 0,
  },
  daySelected: {
    borderWidth: 2,
    borderColor: Brand.ink,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.ink,
  },
  dayNumberOnAccent: {
    color: Brand.paper,
  },
  dayNumberFuture: {
    color: Brand.neutralStroke,
  },
});
