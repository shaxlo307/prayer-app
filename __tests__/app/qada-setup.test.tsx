import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import { api } from "@/lib/api";
import { getOrCreateSession } from "@/lib/session";

import QadaSetupScreen from "@/app/qada-setup";

jest.mock("@/lib/session", () => ({
  getOrCreateSession: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  api: { listProfiles: jest.fn(), updateProfile: jest.fn() },
}));

const mockGetOrCreateSession = getOrCreateSession as jest.Mock;
const mockListProfiles = api.listProfiles as jest.Mock;
const mockUpdateProfile = api.updateProfile as jest.Mock;

const SESSION = { username: "device-abc", password: "secret", profileId: 5 };

async function waitForLoaded() {
  await waitFor(() =>
    expect(screen.queryByText(/Loading your profile/)).toBeNull(),
  );
}

describe("QadaSetupScreen", () => {
  beforeEach(() => {
    mockGetOrCreateSession.mockReset();
    mockListProfiles.mockReset();
    mockUpdateProfile.mockReset();
    mockGetOrCreateSession.mockResolvedValue(SESSION);
  });

  it("prefills fields from the existing profile", async () => {
    mockListProfiles.mockResolvedValue([
      {
        id: 5,
        type: "self",
        madhhab: "hanafi",
        birth_date: "2000-01-15",
        bulugh_age: 12,
        gender: "male",
        practice_start_date: "2015-06-01",
      },
    ]);

    render(<QadaSetupScreen />);
    await waitForLoaded();

    expect(screen.getByLabelText("Birth date").props.value).toBe(
      "2000-01-15",
    );
    expect(screen.getByLabelText("Bulugh age").props.value).toBe("12");
    expect(screen.getByLabelText("Practice start date").props.value).toBe(
      "2015-06-01",
    );
  });

  it("shows a validation error per invalid field instead of saving", async () => {
    mockListProfiles.mockResolvedValue([]);
    render(<QadaSetupScreen />);
    await waitForLoaded();

    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });

    expect(
      screen.getByText("Enter a valid birth date (YYYY-MM-DD)."),
    ).toBeTruthy();
    expect(
      screen.getByText("Enter a whole number greater than 0."),
    ).toBeTruthy();
    expect(screen.getByText("Select a gender.")).toBeTruthy();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("saves valid input and shows a success message", async () => {
    mockListProfiles.mockResolvedValue([]);
    mockUpdateProfile.mockResolvedValue({
      id: 5,
      birth_date: "2000-01-15",
      bulugh_age: 12,
      gender: "male",
      practice_start_date: "2015-06-01",
    });

    render(<QadaSetupScreen />);
    await waitForLoaded();

    fireEvent.changeText(screen.getByLabelText("Birth date"), "2000-01-15");
    fireEvent.press(screen.getByText("Male"));
    // bulugh age auto-fills to 12 from the Hanafi/male suggestion — accept
    // the suggestion rather than typing over it, to exercise that path too.
    fireEvent.changeText(
      screen.getByLabelText("Practice start date"),
      "2015-06-01",
    );

    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      5,
      {
        birth_date: "2000-01-15",
        bulugh_age: 12,
        gender: "male",
        practice_start_date: "2015-06-01",
      },
      { username: "device-abc", password: "secret" },
    );
    await waitFor(() => expect(screen.getByText("Saved.")).toBeTruthy());
  });

  it("shows a save error and does not claim success if the API call fails", async () => {
    mockListProfiles.mockResolvedValue([]);
    mockUpdateProfile.mockRejectedValue(new Error("network down"));

    render(<QadaSetupScreen />);
    await waitForLoaded();

    fireEvent.changeText(screen.getByLabelText("Birth date"), "2000-01-15");
    fireEvent.changeText(screen.getByLabelText("Bulugh age"), "12");
    fireEvent.press(screen.getByText("Female"));
    fireEvent.changeText(
      screen.getByLabelText("Practice start date"),
      "2015-06-01",
    );

    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });

    expect(screen.getByText("network down")).toBeTruthy();
    expect(screen.queryByText("Saved.")).toBeNull();
  });

  it("auto-suggests a bulugh age from madhhab + gender until the field is edited by hand", async () => {
    mockListProfiles.mockResolvedValue([
      { id: 5, type: "self", madhhab: "shafi" },
    ]);

    render(<QadaSetupScreen />);
    await waitForLoaded();

    fireEvent.press(screen.getByText("Male"));
    expect(screen.getByLabelText("Bulugh age").props.value).toBe("15");

    // Switching gender before manually editing still updates the suggestion.
    fireEvent.press(screen.getByText("Female"));
    expect(screen.getByLabelText("Bulugh age").props.value).toBe("9");

    // Once the person types their own value, switching gender again must
    // not silently overwrite what they entered.
    fireEvent.changeText(screen.getByLabelText("Bulugh age"), "10");
    fireEvent.press(screen.getByText("Male"));
    expect(screen.getByLabelText("Bulugh age").props.value).toBe("10");
  });
});
