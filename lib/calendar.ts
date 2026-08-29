/**
 * Pure calendar logic for the history view: builds a month grid and
 * classifies each day's completion state from that day's prayer logs.
 * Kept dependency-free from React/RN so it's trivial to test.
 */

import type { PrayerLogEntry } from './api';

export type DayCompletion = 'all' | 'partial' | 'none' | 'future';

const TOTAL_PRAYERS = 5;

/** Formats a Date as YYYY-MM-DD (same convention used across the app). */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local-midnight Date. Deliberately not
 * `new Date(isoString)` — that parses as UTC midnight, which can shift to
 * the previous/next calendar day once converted to local time depending on
 * the user's timezone offset.
 */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Groups a flat list of logs into a map keyed by their ISO date string. */
export function groupLogsByDate(logs: PrayerLogEntry[]): Record<string, PrayerLogEntry[]> {
  const byDate: Record<string, PrayerLogEntry[]> = {};
  for (const log of logs) {
    (byDate[log.date] ??= []).push(log);
  }
  return byDate;
}

/**
 * A day "counts" toward completion only if all 5 prayers are done or late
 * — matching the spec's streak-calculation rule, reused here for
 * consistent calendar coloring.
 */
export function completionForDay(
  dayLogs: PrayerLogEntry[] | undefined,
  iso: string,
  todayIso: string
): DayCompletion {
  if (iso > todayIso) return 'future';
  const trackedCount = (dayLogs ?? []).filter((l) => l.status === 'done' || l.status === 'late')
    .length;
  if (trackedCount >= TOTAL_PRAYERS) return 'all';
  if (trackedCount > 0) return 'partial';
  return 'none';
}

export interface CalendarCell {
  date: Date | null; // null for leading/trailing blanks outside this month
  iso: string | null;
  dayOfMonth: number | null;
  completion: DayCompletion | null;
}

/**
 * Builds a Monday-start month grid (weeks of 7) for the given year/month,
 * with each in-month day classified by completion. Leading/trailing cells
 * from adjacent months are represented as blanks (`date: null`) rather than
 * showing neighboring-month days, keeping the grid unambiguous about which
 * month is being viewed.
 */
export function buildMonthGrid(
  year: number,
  month: number, // 0-indexed, matches Date's convention
  logsByDate: Record<string, PrayerLogEntry[]>,
  today: Date = new Date()
): CalendarCell[] {
  const todayIso = toISODate(today);
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // JS getDay(): 0=Sunday..6=Saturday. Convert to Monday-start offset (0=Mon..6=Sun).
  const firstWeekday = firstOfMonth.getDay();
  const leadingBlanks = (firstWeekday + 6) % 7;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ date: null, iso: null, dayOfMonth: null, completion: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const iso = toISODate(date);
    cells.push({
      date,
      iso,
      dayOfMonth: day,
      completion: completionForDay(logsByDate[iso], iso, todayIso),
    });
  }
  // Trailing blanks to complete the final week.
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, iso: null, dayOfMonth: null, completion: null });
  }
  return cells;
}
