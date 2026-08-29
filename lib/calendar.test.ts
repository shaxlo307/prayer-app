import { buildMonthGrid, completionForDay, groupLogsByDate, parseISODate, toISODate } from './calendar';
import type { PrayerLogEntry } from './api';

function makeLog(date: string, prayer: PrayerLogEntry['prayer'], status: PrayerLogEntry['status']): PrayerLogEntry {
  return { id: Math.random(), profile: 1, date, prayer, status, created_at: '', updated_at: '' };
}

describe('toISODate', () => {
  it('zero-pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseISODate', () => {
  it('round-trips with toISODate without shifting a day', () => {
    const original = new Date(2026, 7, 5);
    const iso = toISODate(original);
    const parsed = parseISODate(iso);
    expect(toISODate(parsed)).toBe(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(5);
  });

  it('correctly parses the first and last day of a month', () => {
    expect(toISODate(parseISODate('2026-08-01'))).toBe('2026-08-01');
    expect(toISODate(parseISODate('2026-08-31'))).toBe('2026-08-31');
  });
});

describe('groupLogsByDate', () => {
  it('groups multiple logs under the same date', () => {
    const logs = [
      makeLog('2026-08-18', 'fajr', 'done'),
      makeLog('2026-08-18', 'dhuhr', 'done'),
      makeLog('2026-08-17', 'fajr', 'late'),
    ];
    const grouped = groupLogsByDate(logs);
    expect(grouped['2026-08-18']).toHaveLength(2);
    expect(grouped['2026-08-17']).toHaveLength(1);
  });

  it('returns an empty object for an empty log list', () => {
    expect(groupLogsByDate([])).toEqual({});
  });
});

describe('completionForDay', () => {
  const TODAY = '2026-08-18';

  it('marks a day with all 5 prayers done as "all"', () => {
    const logs = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((p) =>
      makeLog(TODAY, p as PrayerLogEntry['prayer'], 'done')
    );
    expect(completionForDay(logs, TODAY, TODAY)).toBe('all');
  });

  it('counts "late" the same as "done" toward completion', () => {
    const logs = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((p, i) =>
      makeLog(TODAY, p as PrayerLogEntry['prayer'], i === 0 ? 'late' : 'done')
    );
    expect(completionForDay(logs, TODAY, TODAY)).toBe('all');
  });

  it('marks partial completion when 1-4 prayers are tracked', () => {
    const logs = [makeLog(TODAY, 'fajr', 'done'), makeLog(TODAY, 'dhuhr', 'late')];
    expect(completionForDay(logs, TODAY, TODAY)).toBe('partial');
  });

  it('marks a day with zero tracked prayers as "none"', () => {
    expect(completionForDay([], TODAY, TODAY)).toBe('none');
    expect(completionForDay(undefined, TODAY, TODAY)).toBe('none');
  });

  it('marks a day with only unmarked entries as "none", not "partial"', () => {
    const logs = [makeLog(TODAY, 'fajr', 'unmarked')];
    expect(completionForDay(logs, TODAY, TODAY)).toBe('none');
  });

  it('marks a day after today as "future" regardless of logs', () => {
    expect(completionForDay([], '2026-08-19', TODAY)).toBe('future');
  });

  it('does not mark today itself as future', () => {
    expect(completionForDay([], TODAY, TODAY)).toBe('none');
  });
});

describe('buildMonthGrid', () => {
  it('produces a grid whose length is a multiple of 7', () => {
    const grid = buildMonthGrid(2026, 7, {}, new Date(2026, 7, 18)); // August 2026
    expect(grid.length % 7).toBe(0);
  });

  it('includes exactly the right number of in-month days', () => {
    const grid = buildMonthGrid(2026, 7, {}, new Date(2026, 7, 18)); // August has 31 days
    const inMonthCells = grid.filter((c) => c.date !== null);
    expect(inMonthCells).toHaveLength(31);
  });

  it('starts the grid on a Monday (leading blanks fill Mon-start offset)', () => {
    // August 1, 2026 is a Saturday, so Monday-start grid needs 5 leading blanks.
    const grid = buildMonthGrid(2026, 7, {}, new Date(2026, 7, 18));
    const firstRealCellIndex = grid.findIndex((c) => c.date !== null);
    expect(firstRealCellIndex).toBe(5);
  });

  it('classifies each in-month day using the provided logs', () => {
    const logsByDate = groupLogsByDate([
      makeLog('2026-08-05', 'fajr', 'done'),
      makeLog('2026-08-05', 'dhuhr', 'done'),
      makeLog('2026-08-05', 'asr', 'done'),
      makeLog('2026-08-05', 'maghrib', 'done'),
      makeLog('2026-08-05', 'isha', 'done'),
    ]);
    const grid = buildMonthGrid(2026, 7, logsByDate, new Date(2026, 7, 18));
    const aug5 = grid.find((c) => c.iso === '2026-08-05');
    expect(aug5?.completion).toBe('all');

    const aug6 = grid.find((c) => c.iso === '2026-08-06');
    expect(aug6?.completion).toBe('none');
  });

  it('marks days after "today" as future within the same grid', () => {
    const grid = buildMonthGrid(2026, 7, {}, new Date(2026, 7, 18));
    const aug25 = grid.find((c) => c.iso === '2026-08-25');
    expect(aug25?.completion).toBe('future');
  });
});
