import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getNetStatus,
  isOffline,
  reportRadioState,
  reportReachable,
  reportUnreachable,
  subscribeNetStatus,
} from "@/lib/netStatus";

// The store is module-level singleton state, so each test resets it to the
// shape a fresh app launch would see.
function reset() {
  reportRadioState(true);
  reportReachable();
  reportRadioState(true);
}

describe("netStatus", () => {
  beforeEach(() => {
    reset();
  });

  it("treats an unknown reachability as online so cold start doesn't flash a banner", () => {
    reportRadioState(false);
    reportRadioState(true); // regaining the network resets reachability to unknown
    expect(getNetStatus().reachability).toBe("unknown");
    expect(isOffline(getNetStatus())).toBe(false);
  });

  it("is offline when the OS reports no network", () => {
    reportRadioState(false);
    expect(isOffline(getNetStatus())).toBe(true);
  });

  it("is offline when a request failed even though the OS says we're online", () => {
    // The captive-portal / dead-backend case the OS signal alone can't catch.
    reportRadioState(true);
    reportUnreachable();
    expect(getNetStatus().radioOnline).toBe(true);
    expect(isOffline(getNetStatus())).toBe(true);
  });

  it("comes back online once a request succeeds", () => {
    reportUnreachable();
    expect(isOffline(getNetStatus())).toBe(true);
    reportReachable();
    expect(isOffline(getNetStatus())).toBe(false);
  });

  it("records when we last reached the server", () => {
    reportReachable();
    expect(getNetStatus().lastReachableAt).toBeGreaterThan(0);
  });

  it("notifies subscribers only when the verdict actually changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNetStatus(listener);

    reportUnreachable();
    reportUnreachable(); // already unreachable — no second notification
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    reportReachable();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
