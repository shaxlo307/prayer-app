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
