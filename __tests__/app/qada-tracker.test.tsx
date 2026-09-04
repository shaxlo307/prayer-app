import { render, screen, waitFor } from "@testing-library/react-native";

import { ApiError, api } from "@/lib/api";
import { getOrCreateSession } from "@/lib/session";

import QadaTrackerScreen from "@/app/qada-tracker";

jest.mock("@/lib/session", () => ({
  getOrCreateSession: jest.fn(),
}));

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    api: { listQadaDebt: jest.fn(), calculateQadaDebt: jest.fn() },
  };
});

const mockGetOrCreateSession = getOrCreateSession as jest.Mock;
const mockListQadaDebt = api.listQadaDebt as jest.Mock;
const mockCalculateQadaDebt = api.calculateQadaDebt as jest.Mock;

const SESSION = { username: "device-abc", password: "secret", profileId: 5 };

function debtRow(prayer: string, initial: number, remaining: number) {
  return {
    id: Math.random(),
    profile: 5,
    prayer,
    initial_count: initial,
    remaining_count: remaining,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const FULL_DEBT = [
  debtRow("fajr", 300, 230),
  debtRow("dhuhr", 300, 230),
  debtRow("asr", 300, 230),
  debtRow("maghrib", 300, 230),
  debtRow("isha", 300, 230),
];

async function waitForLoaded() {
  await waitFor(() =>
    expect(screen.queryByText(/Loading your qada tracker/)).toBeNull(),
  );
}

describe("QadaTrackerScreen", () => {
  beforeEach(() => {
    mockGetOrCreateSession.mockReset();
    mockListQadaDebt.mockReset();
    mockCalculateQadaDebt.mockReset();
    mockGetOrCreateSession.mockResolvedValue(SESSION);
  });

  it("shows 5 progress bars with the real remaining counts already calculated", async () => {
    mockListQadaDebt.mockResolvedValue(FULL_DEBT);

    await render(<QadaTrackerScreen />);
    await waitForLoaded();

    expect(screen.getByText("Fajr")).toBeTruthy();
    expect(screen.getByText("Dhuhr")).toBeTruthy();
    expect(screen.getByText("Asr")).toBeTruthy();
    expect(screen.getByText("Maghrib")).toBeTruthy();
    expect(screen.getByText("Isha")).toBeTruthy();
    expect(screen.getAllByText("230 remaining")).toHaveLength(5);
    expect(mockCalculateQadaDebt).not.toHaveBeenCalled();
  });

  it("shows a combined overall bar summed across all 5 prayers", async () => {
    mockListQadaDebt.mockResolvedValue(FULL_DEBT);

    await render(<QadaTrackerScreen />);
    await waitForLoaded();

    expect(screen.getByText("Overall")).toBeTruthy();
    // 5 x 230 = 1150 remaining overall.
    expect(screen.getByText("1,150 remaining")).toBeTruthy();
  });

  it("filters the account's debt rows to only this profile", async () => {
    mockListQadaDebt.mockResolvedValue([
      ...FULL_DEBT,
      { ...debtRow("fajr", 100, 50), profile: 999 }, // a different profile
    ]);

    await render(<QadaTrackerScreen />);
    await waitForLoaded();

    // Still 230 remaining for Fajr (own profile), not mixed with 999's row.
    expect(screen.getAllByText("230 remaining")).toHaveLength(5);
  });

  it("triggers calculation automatically when nothing has been calculated yet", async () => {
    mockListQadaDebt.mockResolvedValue([]); // no rows for this profile
    mockCalculateQadaDebt.mockResolvedValue(FULL_DEBT);

    await render(<QadaTrackerScreen />);
    await waitForLoaded();

    expect(mockCalculateQadaDebt).toHaveBeenCalledWith(
      5,
      {},
      { username: "device-abc", password: "secret" },
    );
    expect(screen.getAllByText("230 remaining")).toHaveLength(5);
  });

  it("shows a link to qada setup when the profile isn't set up yet", async () => {
    mockListQadaDebt.mockResolvedValue([]);
    mockCalculateQadaDebt.mockRejectedValue(new ApiError(400, { detail: "incomplete" }));

    await render(<QadaTrackerScreen />);
    await waitForLoaded();

    expect(screen.getByText("Go to qada setup →")).toBeTruthy();
  });

  it("shows an error message for a non-400 failure", async () => {
    mockListQadaDebt.mockRejectedValue(new Error("network down"));

    await render(<QadaTrackerScreen />);
    await waitForLoaded();

    expect(screen.getByText("network down")).toBeTruthy();
  });

  it("shows all caught up once remaining count reaches zero", async () => {
    mockListQadaDebt.mockResolvedValue([
      debtRow("fajr", 300, 0),
      debtRow("dhuhr", 300, 0),
      debtRow("asr", 300, 0),
      debtRow("maghrib", 300, 0),
      debtRow("isha", 300, 0),
    ]);

    await render(<QadaTrackerScreen />);
    await waitForLoaded();

    expect(screen.getAllByText("All caught up")).toHaveLength(6); // 5 prayers + overall
  });
});
