import { ApiError, api } from "./api";

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("api.health", () => {
  it("returns the parsed health payload on success", async () => {
    mockFetchOnce(200, {
      status: "ok",
      service: "prayer-app-backend",
      database: "connected",
    });

    const result = await api.health();

    expect(result.status).toBe("ok");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/health/"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws ApiError with the response body when the server errors", async () => {
    mockFetchOnce(500, { detail: "server exploded" });

    await expect(api.health()).rejects.toThrow(ApiError);
    await expect(api.health()).rejects.toMatchObject({
      status: 500,
      body: { detail: "server exploded" },
    });
  });
});

describe("api.createProfile", () => {
  it("sends Basic Auth header when credentials are provided", async () => {
    mockFetchOnce(201, { id: 1, display_name: "Alice" });

    await api.createProfile(
      { display_name: "Alice" },
      { username: "alice", password: "pw" },
    );

    const call = (fetch as jest.Mock).mock.calls[0];
    const options = call[1];
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe(`Basic ${btoa("alice:pw")}`);
    expect(JSON.parse(options.body)).toEqual({ display_name: "Alice" });
  });

  it("omits the Authorization header when no auth is given", async () => {
    mockFetchOnce(201, { id: 1 });

    await api.createProfile({ display_name: "Alice" }, undefined);

    const call = (fetch as jest.Mock).mock.calls[0];
    expect(call[1].headers.Authorization).toBeUndefined();
  });
});

describe("api.updateProfile", () => {
  it("PATCHes the profile at its id with the given fields and auth", async () => {
    mockFetchOnce(200, {
      id: 5,
      birth_date: "2000-01-15",
      bulugh_age: 12,
      gender: "male",
      practice_start_date: "2015-06-01",
    });

    await api.updateProfile(
      5,
      {
        birth_date: "2000-01-15",
        bulugh_age: 12,
        gender: "male",
        practice_start_date: "2015-06-01",
      },
      { username: "device-abc", password: "secret" },
    );

    const call = (fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain("/api/profiles/5/");
    const options = call[1];
    expect(options.method).toBe("PATCH");
    expect(options.headers.Authorization).toBe(
      `Basic ${btoa("device-abc:secret")}`,
    );
    expect(JSON.parse(options.body)).toEqual({
      birth_date: "2000-01-15",
      bulugh_age: 12,
      gender: "male",
      practice_start_date: "2015-06-01",
    });
  });

  it("returns the updated profile on success", async () => {
    mockFetchOnce(200, { id: 5, bulugh_age: 13 });

    const result = await api.updateProfile(
      5,
      { bulugh_age: 13 },
      { username: "a", password: "b" },
    );

    expect(result.bulugh_age).toBe(13);
  });

  it("propagates a validation error (e.g. bad gender) as ApiError", async () => {
    mockFetchOnce(400, { gender: ["Not a valid choice."] });

    await expect(
      api.updateProfile(
        5,
        { gender: "other" as never },
        { username: "a", password: "b" },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("api.listQadaDebt", () => {
  it("returns the parsed list of debt rows", async () => {
    mockFetchOnce(200, [
      { id: 1, profile: 5, prayer: "fajr", initial_count: 300, remaining_count: 250, updated_at: "x" },
    ]);

    const result = await api.listQadaDebt({ username: "a", password: "b" });

    expect(result).toHaveLength(1);
    expect(result[0].remaining_count).toBe(250);
    const call = (fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain("/api/qada-debt/");
    expect(call[1].method).toBe("GET");
  });
});

describe("api.calculateQadaDebt", () => {
  it("POSTs to the profile's calculate-qada-debt action with no body by default", async () => {
    mockFetchOnce(200, [{ id: 1, profile: 5, prayer: "fajr", initial_count: 300, remaining_count: 300, updated_at: "x" }]);

    await api.calculateQadaDebt(5, {}, { username: "a", password: "b" });

    const call = (fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain("/api/profiles/5/calculate-qada-debt/");
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBeUndefined();
  });

  it("sends { force: true } in the body when force is requested", async () => {
    mockFetchOnce(200, []);

    await api.calculateQadaDebt(5, { force: true }, { username: "a", password: "b" });

    const call = (fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ force: true });
  });

  it("propagates a 400 (incomplete qada setup) as ApiError", async () => {
    mockFetchOnce(400, { detail: "Profile is missing birth_date..." });

    await expect(
      api.calculateQadaDebt(5, {}, { username: "a", password: "b" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("api.createPrayerLog", () => {
  it("propagates a 400 (e.g. duplicate prayer for the day) as ApiError", async () => {
    mockFetchOnce(400, { non_field_errors: ["must make a unique set"] });

    await expect(
      api.createPrayerLog(
        { profile: 1, date: "2026-08-18", prayer: "fajr", status: "done" },
        { username: "alice", password: "pw" },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
