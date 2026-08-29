import { act, renderHook, waitFor } from '@testing-library/react-native';

import { loadTodayLogs, syncPrayerStatus } from '@/lib/prayerLogSync';

import { usePrayerDay } from './usePrayerDay';

jest.mock('@/lib/prayerLogSync', () => ({
  loadTodayLogs: jest.fn(),
  syncPrayerStatus: jest.fn(),
}));

const mockLoadTodayLogs = loadTodayLogs as jest.Mock;
const mockSyncPrayerStatus = syncPrayerStatus as jest.Mock;

const SESSION = { username: 'device-abc', password: 'secret', profileId: 5 };
const DATE = new Date(2026, 7, 18);

describe('usePrayerDay', () => {
  beforeEach(() => {
    mockLoadTodayLogs.mockReset();
    mockSyncPrayerStatus.mockReset();
  });

  it('loads existing logs for the given date on mount', async () => {
    mockLoadTodayLogs.mockResolvedValue({
      fajr: { id: 1, profile: 5, date: '2026-08-18', prayer: 'fajr', status: 'done' },
    });

    const { result } = await renderHook(() => usePrayerDay(DATE, SESSION));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statuses.fajr).toBe('done');
    expect(result.current.statuses.dhuhr).toBe('unmarked');
  });

  it('does nothing when there is no session yet', async () => {
    const { result } = await renderHook(() => usePrayerDay(DATE, null));
    expect(mockLoadTodayLogs).not.toHaveBeenCalled();
    expect(result.current.statuses.fajr).toBe('unmarked');
  });

  it('toggleDone creates a new log (POST path) when none exists yet', async () => {
    mockLoadTodayLogs.mockResolvedValue({});
    mockSyncPrayerStatus.mockResolvedValue({
      id: 10,
      profile: 5,
      date: '2026-08-18',
      prayer: 'asr',
      status: 'done',
    });

    const { result } = await renderHook(() => usePrayerDay(DATE, SESSION));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.toggleDone('asr');
    });

    await waitFor(() => expect(result.current.statuses.asr).toBe('done'));
    expect(mockSyncPrayerStatus).toHaveBeenCalledWith(
      expect.objectContaining({ prayer: 'asr', status: 'done', existingLogId: null })
    );
  });

  it('toggleDone updates (PATCH path) when a log already exists', async () => {
    mockLoadTodayLogs.mockResolvedValue({
      asr: { id: 10, profile: 5, date: '2026-08-18', prayer: 'asr', status: 'done' },
    });
    mockSyncPrayerStatus.mockResolvedValue({
      id: 10,
      profile: 5,
      date: '2026-08-18',
      prayer: 'asr',
      status: 'unmarked',
    });

    const { result } = await renderHook(() => usePrayerDay(DATE, SESSION));
    await waitFor(() => expect(result.current.statuses.asr).toBe('done'));

    await act(async () => {
      result.current.toggleDone('asr');
    });

    await waitFor(() => expect(result.current.statuses.asr).toBe('unmarked'));
    expect(mockSyncPrayerStatus).toHaveBeenCalledWith(
      expect.objectContaining({ prayer: 'asr', status: 'unmarked', existingLogId: 10 })
    );
  });

  it('rolls back the optimistic update if the sync fails', async () => {
    mockLoadTodayLogs.mockResolvedValue({});
    mockSyncPrayerStatus.mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => usePrayerDay(DATE, SESSION));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.toggleDone('isha');
    });

    await waitFor(() => expect(result.current.syncError).toBeTruthy());
    expect(result.current.statuses.isha).toBe('unmarked'); // rolled back
  });

  it('markLate sets status to late', async () => {
    mockLoadTodayLogs.mockResolvedValue({});
    mockSyncPrayerStatus.mockResolvedValue({
      id: 11,
      profile: 5,
      date: '2026-08-18',
      prayer: 'maghrib',
      status: 'late',
    });

    const { result } = await renderHook(() => usePrayerDay(DATE, SESSION));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.markLate('maghrib');
    });

    await waitFor(() => expect(result.current.statuses.maghrib).toBe('late'));
  });

  it('ignores a second tap on the same prayer while one is already pending', async () => {
    mockLoadTodayLogs.mockResolvedValue({});
    let resolveSync: (value: unknown) => void;
    mockSyncPrayerStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve;
      })
    );

    const { result } = await renderHook(() => usePrayerDay(DATE, SESSION));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.toggleDone('fajr');
    });
    await act(async () => {
      result.current.toggleDone('fajr'); // second tap while first is in-flight
    });

    expect(mockSyncPrayerStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSync!({ id: 1, profile: 5, date: '2026-08-18', prayer: 'fajr', status: 'done' });
    });
  });

  it('uses the shared local-date-safe toISODate for the optimistic placeholder, not UTC-based formatting', async () => {
    // Regression test for a real bug found during Day 12 stabilization:
    // the optimistic placeholder used to compute its `date` field via
    // date.toISOString().slice(0, 10), which is a UTC conversion and can
    // silently produce the wrong calendar date near midnight depending on
    // the user's timezone. It must instead delegate to the shared
    // toISODate helper — this spy directly proves that call happens.
    const calendarModule = jest.requireActual('@/lib/calendar');
    const toISODateSpy = jest.spyOn(calendarModule, 'toISODate');

    mockLoadTodayLogs.mockResolvedValue({});
    mockSyncPrayerStatus.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = await renderHook(() => usePrayerDay(DATE, SESSION));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.toggleDone('fajr');
    });

    await waitFor(() => expect(result.current.statuses.fajr).toBe('done'));
    expect(toISODateSpy).toHaveBeenCalledWith(DATE);

    toISODateSpy.mockRestore();
  });
});
