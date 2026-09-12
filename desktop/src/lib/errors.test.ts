import { describe, expect, it } from "vitest";
import { getErrorMessage, isAuthError, isNetworkError } from "@/lib/errors";

describe("isNetworkError", () => {
  it("recognises a thrown fetch", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("recognises our own request timeouts", () => {
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    expect(isNetworkError(aborted)).toBe(true);
  });

  // This is the distinction the whole offline fix rests on: a 401 must stay a
  // 401 so a genuinely revoked session still logs the user out.
  it("does not treat an auth rejection as a network failure", () => {
    expect(isNetworkError({ status: 401, detail: "Unauthorized" })).toBe(false);
  });

  it("does not treat a server error as a network failure", () => {
    expect(isNetworkError({ status: 500, detail: "Internal error" })).toBe(false);
  });

  it("ignores null and undefined", () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe("isAuthError", () => {
  it("is true only for a 401", () => {
    expect(isAuthError({ status: 401 })).toBe(true);
    expect(isAuthError({ status: 500 })).toBe(false);
    expect(isAuthError(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("explains connectivity failures instead of surfacing 'Failed to fetch'", () => {
    expect(getErrorMessage(new TypeError("Failed to fetch"))).toContain("offline");
  });

  it("prefers the problem+json detail for real API errors", () => {
    expect(getErrorMessage({ status: 400, detail: "Name is required" })).toBe("Name is required");
  });

  it("falls back when there's nothing useful to show", () => {
    expect(getErrorMessage({}, "Could not save")).toBe("Could not save");
  });
});
