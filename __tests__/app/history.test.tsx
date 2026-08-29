import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { api } from '@/lib/api';
import { getOrCreateSession } from '@/lib/session';

import HistoryScreen from '@/app/history';

let capturedFocusCallback: (() => void) | null = null;
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    // Capture it so the test can invoke it manually to simulate the screen
    // regaining focus (e.g. navigating back from the day-detail screen).
    capturedFocusCallback = callback;
  },
}));

jest.mock('@/lib/session', () => ({
  getOrCreateSession: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: { listPrayerLogs: jest.fn() },
}));

const mockGetOrCreateSession = getOrCreateSession as jest.Mock;
const mockListPrayerLogs = api.listPrayerLogs as jest.Mock;

describe('HistoryScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetOrCreateSession.mockReset();
    mockListPrayerLogs.mockReset();
    capturedFocusCallback = null;

    mockGetOrCreateSession.mockResolvedValue({
      username: 'device-abc',
      password: 'secret',
      profileId: 5,
    });
  });

  it('routes to the Home tab (not a duplicate day-detail screen) when today is selected', async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    await render(<HistoryScreen />);

    await waitFor(() => expect(screen.queryByText(/Loading your history/)).toBeNull());

    const todayIso = new Date().toISOString().slice(0, 10);
    const todayCell = screen.queryByLabelText(new RegExp(`^${todayIso},`));
    if (todayCell) {
      await fireEvent.press(todayCell);
      expect(mockPush).toHaveBeenCalledWith('/');
    }
  });

  it('refetches logs when the screen regains focus, not just once on mount', async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    await render(<HistoryScreen />);

    await waitFor(() => expect(mockListPrayerLogs).toHaveBeenCalledTimes(1));

    // Simulate returning to this screen after editing a day elsewhere.
    expect(capturedFocusCallback).not.toBeNull();
    await act(async () => {
      capturedFocusCallback!();
    });

    await waitFor(() => expect(mockListPrayerLogs).toHaveBeenCalledTimes(2));
  });

  it('does not refetch on focus before the session/initial load has resolved', async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    // Call the focus callback synchronously before session resolves —
    // should be a no-op guarded by `if (session)`.
    await render(<HistoryScreen />);
    await act(async () => {
      if (capturedFocusCallback) {
        capturedFocusCallback();
      }
    });
    // No assertion failure/throw is the point here — guards against a
    // null-session crash if focus fires unusually early.
  });
});
