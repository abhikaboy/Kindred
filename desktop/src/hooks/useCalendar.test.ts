import { describe, it, expect, vi, beforeEach } from "vitest";
import { pollForNewConnection } from "./useCalendar";

// vi.mock is hoisted; use vi.hoisted to define the spy before the factory runs.
const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({
  default: { GET: mockGet },
}));

function makeConnection(id: string): import("./useCalendar").CalendarConnection {
  return {
    id,
    user_id: "u1",
    provider: "google",
    provider_account_id: "acc@example.com",
    scopes: [],
    is_primary: false,
    setup_complete: false,
    last_sync: "",
    last_heartbeat: "",
    health_status: "ok",
    make_public: false,
    created_at: "",
    updated_at: "",
  };
}

beforeEach(() => {
  mockGet.mockReset();
});

describe("pollForNewConnection", () => {
  it("resolves with the new connection when one appears whose id is not in knownIds", async () => {
    const existing = makeConnection("existing-1");
    const newConn = makeConnection("new-1");

    // First call returns only known connections; second call includes the new one.
    mockGet
      .mockResolvedValueOnce({ data: { connections: [existing] } })
      .mockResolvedValueOnce({ data: { connections: [existing, newConn] } });

    const result = await pollForNewConnection(new Set(["existing-1"]), {
      intervalMs: 0,
      maxAttempts: 5,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("new-1");
  });

  it("resolves with null after maxAttempts without finding a new connection", async () => {
    const existing = makeConnection("existing-1");
    mockGet.mockResolvedValue({ data: { connections: [existing] } });

    const result = await pollForNewConnection(new Set(["existing-1"]), {
      intervalMs: 0,
      maxAttempts: 3,
    });

    expect(result).toBeNull();
    expect(mockGet).toHaveBeenCalledTimes(3);
  });
});
