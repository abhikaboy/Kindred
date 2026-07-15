import { beforeEach, describe, expect, it } from "vitest";
import { tokens, isTokenExpired, getTokenExpiry, type AuthTokens } from "@/lib/tokens";

// Build a fake JWT `header.payload.sig` where payload = { exp: <epoch seconds> }.
function makeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `${header}.${payload}.sig`;
}

describe("tokens store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips set → get", () => {
    const t: AuthTokens = { access_token: "a", refresh_token: "r" };
    tokens.set(t);
    expect(tokens.get()).toEqual(t);
  });

  it("clear removes the stored tokens", () => {
    tokens.set({ access_token: "a", refresh_token: "r" });
    tokens.clear();
    expect(tokens.get()).toBeNull();
  });

  it("get returns null when nothing is stored", () => {
    expect(tokens.get()).toBeNull();
  });

  it("get returns null on corrupt data", () => {
    localStorage.setItem("auth_data", "not-json{{{");
    expect(tokens.get()).toBeNull();
  });

  it("get returns null when the shape is wrong", () => {
    localStorage.setItem("auth_data", JSON.stringify({ foo: "bar" }));
    expect(tokens.get()).toBeNull();
  });
});

describe("token expiry", () => {
  it("treats a clearly expired token as expired", () => {
    const expired = makeJwt(Math.floor(Date.now() / 1000) - 3600); // 1h ago
    expect(isTokenExpired(expired)).toBe(true);
  });

  it("treats a clearly valid token as not expired", () => {
    const valid = makeJwt(Math.floor(Date.now() / 1000) + 3600); // 1h ahead
    expect(isTokenExpired(valid)).toBe(false);
  });

  it("treats an unparseable token as expired", () => {
    expect(isTokenExpired("garbage")).toBe(true);
  });

  it("getTokenExpiry returns null for an unparseable token", () => {
    expect(getTokenExpiry("garbage")).toBeNull();
  });

  it("getTokenExpiry returns epoch ms for a valid token", () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 100;
    expect(getTokenExpiry(makeJwt(expSeconds))).toBe(expSeconds * 1000);
  });
});
