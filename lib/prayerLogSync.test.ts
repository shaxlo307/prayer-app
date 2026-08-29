import { api } from './api';
import { formatISODate, loadTodayLogs, syncPrayerStatus } from './prayerLogSync';

jest.mock('./api', () => ({
  api: {
    listPrayerLogs: jest.fn(),
    createPrayerLog: jest.fn(),
    updatePrayerLog: jest.fn(),
  },
}));

const mockListPrayerLogs = api.listPrayerLogs as jest.Mock;
const mockCreatePrayerLog = api.createPrayerLog as jest.Mock;
const mockUpdatePrayerLog = api.updatePrayerLog as jest.Mock;

const AUTH = { username: 'device-abc', password: 'secret' };

describe('formatISODate', () => {
  it('formats a date as YYYY-MM-DD with zero-padding', () => {
    expect(formatISODate(new Date(2026, 0, 5))).toBe('2026-01-05'); // Jan 5 (month is 0-indexed)
  });

  it('handles double-digit months and days', () => {
    expect(formatISODate(new Date(2026, 10, 23))).toBe('2026-11-23');
  });
});

describe('loadTodayLogs', () => {
  beforeEach(() => {
    mockListPrayerLogs.mockReset();
  });

  it('filters to only today\'s logs and keys them by prayer', async () => {
    mockListPrayerLogs.mockResolvedValue([
      { id: 1, profile: 5, date: '2026-08-18', prayer: 'fajr', status: 'done' },
      { id: 2, profile: 5, date: '2026-08-18', prayer: 'dhuhr', status: 'late' },
      { id: 3, profile: 5, date: '2026-08-17', prayer: 'fajr', status: 'done' }, // yesterday
    ]);

    const result = await loadTodayLogs(AUTH, new Date(2026, 7, 18));

    expect(Object.keys(result)).toEqual(['fajr', 'dhuhr']);
    expect(result.fajr?.status).toBe('done');
    expect(result.dhuhr?.status).toBe('late');
    expect(result.asr).toBeUndefined();
  });

  it('returns an empty object when there are no logs at all', async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    const result = await loadTodayLogs(AUTH, new Date(2026, 7, 18));
    expect(result).toEqual({});
  });

  it('passes the auth credentials through to the API call', async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    await loadTodayLogs(AUTH, new Date(2026, 7, 18));
    expect(mockListPrayerLogs).toHaveBeenCalledWith(AUTH);
  });
});

describe('syncPrayerStatus', () => {
  beforeEach(() => {
    mockCreatePrayerLog.mockReset();
    mockUpdatePrayerLog.mockReset();
  });

  it('creates a new log when no existing log id is given (first tap of the day)', async () => {
    mockCreatePrayerLog.mockResolvedValue({
      id: 99,
      profile: 5,
      date: '2026-08-18',
      prayer: 'fajr',
      status: 'done',
    });

    const result = await syncPrayerStatus({
      profileId: 5,
      date: new Date(2026, 7, 18),
      prayer: 'fajr',
      status: 'done',
      existingLogId: null,
      auth: AUTH,
    });

    expect(mockCreatePrayerLog).toHaveBeenCalledWith(
      { profile: 5, date: '2026-08-18', prayer: 'fajr', status: 'done' },
      AUTH
    );
    expect(mockUpdatePrayerLog).not.toHaveBeenCalled();
    expect(result.id).toBe(99);
  });

  it('updates the existing log when an id is given (subsequent taps)', async () => {
    mockUpdatePrayerLog.mockResolvedValue({
      id: 42,
      profile: 5,
      date: '2026-08-18',
      prayer: 'fajr',
      status: 'unmarked',
    });

    const result = await syncPrayerStatus({
      profileId: 5,
      date: new Date(2026, 7, 18),
      prayer: 'fajr',
      status: 'unmarked',
      existingLogId: 42,
      auth: AUTH,
    });

    expect(mockUpdatePrayerLog).toHaveBeenCalledWith(42, { status: 'unmarked' }, AUTH);
    expect(mockCreatePrayerLog).not.toHaveBeenCalled();
    expect(result.status).toBe('unmarked');
  });
});
