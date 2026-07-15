const STORAGE_KEY = "auth_data";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * localStorage-backed token store. Synchronous replacement for the mobile
 * app's expo-secure-store, keyed on "auth_data" with a JSON payload.
 */
export const tokens = {
  get(): AuthTokens | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.access_token === "string" &&
        typeof parsed.refresh_token === "string"
      ) {
        return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
      }
      return null;
    } catch {
      return null;
    }
  },

  set(t: AuthTokens): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};

/**
 * Decode the `exp` claim from a JWT without a library.
 * Returns expiry as epoch milliseconds, or null if unparseable.
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // Handle base64url → base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const claims = JSON.parse(json);
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is expired or will expire within `bufferMs`.
 * Defaults to a 60-second buffer so we refresh proactively.
 */
export function isTokenExpired(token: string, bufferMs = 60_000): boolean {
  const exp = getTokenExpiry(token);
  if (exp === null) return true;
  return Date.now() + bufferMs >= exp;
}
