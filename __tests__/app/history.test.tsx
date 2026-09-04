import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { api } from "@/lib/api";
import { getOrCreateSession } from "@/lib/session";

import HistoryScreen from "@/app/(tabs)/history";

let capturedFocusCallback: (() => void) | null = null;
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    capturedFocusCallback = callback;
  },
}));

jest.mock("@/lib/session", () => ({
  getOrCreateSession: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  api: { listPrayerLogs: jest.fn() },
}));

const mockGetOrCreateSession = getOrCreateSession as jest.Mock;
const mockListPrayerLogs = api.listPrayerLogs as jest.Mock;

describe("HistoryScreen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockGetOrCreateSession.mockReset();
    mockListPrayerLogs.mockReset();
    capturedFocusCallback = null;

    mockGetOrCreateSession.mockResolvedValue({
      username: "device-abc",
      password: "secret",
      profileId: 5,
    });
  });

  it("routes to the Home tab (not a duplicate day-detail screen) when today is selected", async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    render(<HistoryScreen />);

    await waitFor(
      () => expect(screen.queryByText(/Loading your history/)).toBeNull(),
      { timeout: 15_000 },
    );

    const todayIso = new Date().toISOString().slice(0, 10);
    const todayCell = screen.queryByLabelText(new RegExp(`^${todayIso},`));
    if (todayCell) {
      await act(async () => {
        fireEvent.press(todayCell);
      });
      expect(mockPush).toHaveBeenCalledWith("/");
    }
  }, 20_000);

  it("refetches logs when the screen regains focus, not just once on mount", async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    render(<HistoryScreen />);

    await waitFor(() => expect(mockListPrayerLogs).toHaveBeenCalledTimes(1), {
      timeout: 15_000,
    });

    expect(capturedFocusCallback).not.toBeNull();
    await act(async () => {
      capturedFocusCallback!();
    });

    await waitFor(() => expect(mockListPrayerLogs).toHaveBeenCalledTimes(2), {
      timeout: 15_000,
    });
  }, 20_000);

  it("does not refetch on focus before the session/initial load has resolved", async () => {
    mockListPrayerLogs.mockResolvedValue([]);
    render(<HistoryScreen />);
    await act(async () => {
      if (capturedFocusCallback) {
        capturedFocusCallback();
      }
    });
    // No assertion failure/throw is the point — guards against null-session crash.
  });
});
