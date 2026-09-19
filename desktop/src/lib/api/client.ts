import createClient from "openapi-fetch";
import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { paths } from "@/lib/api/types.gen";
import { tokens, isTokenExpired } from "@/lib/tokens";
import { reportReachable, reportUnreachable } from "@/lib/netStatus";

const logger = {
  debug: console.debug,
  warn: console.warn,
  error: console.error,
  info: console.info,
};

// Dev and prod both talk to the real backend (public URL, not a secret). Dev can
// do this directly — rather than through the Vite proxy — because the dev server
// runs on port 3000, which is in the backend's CORS allowlist (see
// backend/internal/server/server.go). Override with VITE_API_URL for a different
// backend, e.g. a local API.
const API_ORIGIN = import.meta.env.VITE_API_URL || "https://kindredtodo.com";
const API_BASE = API_ORIGIN + "/api";

// The built desktop app is served from tauri:// with no dev proxy, and the webview's
// fetch is CORS-blocked by the backend allowlist. Route through the Tauri HTTP plugin
// (native, no CORS). Dev keeps the browser fetch — its origin is allowlisted.
const httpFetch: typeof fetch =
  import.meta.env.PROD && isTauri()
    ? (tauriFetch as typeof fetch)
    : globalThis.fetch.bind(globalThis);

/**
 * Outcome of a token refresh attempt.
 *
 * The distinction between "rejected" and "offline" is the whole point: a
 * rejected refresh means the server told us our credentials are no longer good
 * and we must log the user out. An offline refresh means we never got an answer
 * at all, and logging the user out would be destroying a session that is
 * probably still perfectly valid.
 */
export type RefreshResult = "ok" | "rejected" | "offline";

/**
 * True if this error represents "we could not reach the server", as opposed to
 * the server giving us an answer we didn't like.
 *
 * Covers a thrown `fetch` (TypeError in the browser, a plugin error under
 * Tauri) and aborts from our own request timeouts.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const name = (error as { name?: string }).name;
  if (name === "AbortError" || name === "TimeoutError") return true;
  if (error instanceof TypeError) return true;
  const message = (error as { message?: string }).message ?? "";
  return /network request failed|failed to fetch|network error|timeout|load failed/i.test(message);
}

/** Requests on the auth-critical path get a tighter budget — startup must not hang. */
const AUTH_TIMEOUT_MS = 4_000;
const DEFAULT_TIMEOUT_MS = 8_000;

function timeoutForUrl(url: string): number {
  return /\/(auth\/refresh|user\/login)$/.test(url) ? AUTH_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

/**
 * `httpFetch` with a per-request timeout that also keeps the connectivity store
 * up to date. Without this every request hangs on the platform default, which
 * is what makes a flaky connection feel like a freeze followed by a logout.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs?: number
): Promise<Response> {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? timeoutForUrl(url));

  try {
    const response = await httpFetch(input, { ...init, signal: controller.signal });
    reportReachable();
    return response;
  } catch (error) {
    if (isNetworkError(error)) reportUnreachable();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Logout handler registered by the auth layer to handle 401s
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function clearUnauthorizedHandler(): void {
  onUnauthorized = null;
}

// --- Token refresh infrastructure ---

// Mutex: only one refresh can happen at a time. Other requests wait for it.
let refreshPromise: Promise<RefreshResult> | null = null;

/**
 * Perform a token refresh by calling the dedicated refresh endpoint.
 * Sends the refresh token and receives new access + refresh tokens.
 *
 * Never collapses "the server rejected us" and "we couldn't reach the server"
 * into a single failure value — callers need to tell them apart before they
 * decide to delete the user's tokens.
 */
async function performRefresh(): Promise<RefreshResult> {
  try {
    const authData = tokens.get();
    if (!authData) return "rejected";

    const { refresh_token } = authData;
    if (!refresh_token) return "rejected";

    logger.debug("Performing token refresh");

    const response = await fetchWithTimeout(
      API_ORIGIN + "/api/v1/auth/refresh",
      {
        method: "POST",
        headers: {
          refresh_token: refresh_token,
          "Content-Type": "application/json",
        },
      },
      AUTH_TIMEOUT_MS
    );

    if (response.status === 401) {
      logger.warn("Refresh failed: server returned 401");
      return "rejected";
    }

    // Any other non-OK status is the server having a bad day, not the user
    // being logged out. Treat it as transient.
    if (!response.ok) {
      logger.warn("Refresh failed with status", response.status);
      return "offline";
    }

    // Check for new tokens in response headers
    const newAccess = response.headers.get("access_token");
    const newRefresh = response.headers.get("refresh_token");

    if (newAccess && newRefresh) {
      tokens.set({ access_token: newAccess, refresh_token: newRefresh });
      logger.debug("Token refresh succeeded, new tokens saved");
      return "ok";
    }

    // 2xx but no tokens in the headers — the server is not speaking the
    // protocol we expect. Not an auth rejection.
    logger.warn("Refresh returned no tokens despite an OK status");
    return "offline";
  } catch (error) {
    if (isNetworkError(error)) {
      logger.warn("Token refresh could not reach the server", error);
      return "offline";
    }
    logger.error("Token refresh error", error);
    return "rejected";
  }
}

/**
 * Ensure we have a valid (non-expired) access token before making a request.
 * If the token is expired, triggers a refresh with a mutex so concurrent
 * callers share a single refresh attempt.
 */
async function ensureValidToken(): Promise<RefreshResult> {
  const authData = tokens.get();
  if (!authData) return "rejected";

  const { access_token } = authData;
  if (!access_token) return "rejected";

  // Token still valid — no refresh needed
  if (!isTokenExpired(access_token)) return "ok";

  // Token expired — refresh, but only one at a time
  if (refreshPromise) {
    logger.debug("Waiting for in-progress token refresh");
    return refreshPromise;
  }

  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// Create the base client
const client = createClient<paths>({
  baseUrl: API_BASE,
  // Every request gets a deadline and feeds the connectivity store.
  fetch: (input: Request) => fetchWithTimeout(input),
});

// Add request/response interceptors
client.use({
  async onRequest({ request }) {
    logger.debug("Making request", {
      url: request.url,
      method: request.method,
    });

    try {
      // Proactively refresh if token is expired — prevents 401 race
      await ensureValidToken();

      const authData = tokens.get();

      if (authData) {
        const { access_token, refresh_token } = authData;
        if (access_token) {
          request.headers.set("Authorization", `Bearer ${access_token}`);
        } else {
          logger.warn("No access token found");
        }

        if (refresh_token) {
          request.headers.set("refresh_token", refresh_token);
        } else {
          logger.warn("No refresh token found");
        }
      } else {
        logger.debug("No auth data found for request");
      }
    } catch (error) {
      logger.error("Error in request interceptor", error);
    }

    request.headers.set("Content-Type", "application/json");

    return request;
  },

  async onResponse({ response, request }) {
    // Handle 401 — attempt one refresh + retry before logging out.
    if (response.status === 401) {
      const authData = tokens.get();

      if (authData) {
        const { access_token } = authData;
        const requestToken = request.headers
          .get("Authorization")
          ?.replace("Bearer ", "");

        // If the stored token differs from what this request used,
        // another request already refreshed. Don't log out.
        if (access_token && requestToken && access_token !== requestToken) {
          logger.debug(
            "401 on stale request — tokens already refreshed, skipping logout"
          );
          return response;
        }

        // Tokens match — force a refresh before giving up
        logger.debug("401 with current tokens, attempting refresh + retry");
        const refreshed = await performRefresh();

        // Couldn't reach the refresh endpoint. We have no evidence the session
        // is bad, so keep the tokens and let the caller see a network failure.
        if (refreshed === "offline") {
          logger.warn("Refresh unreachable during 401 handling, keeping session");
          return response;
        }

        if (refreshed === "ok") {
          // Retry the original request with new tokens
          const freshAuthData = tokens.get();
          if (freshAuthData) {
            const { access_token: newAccess, refresh_token: newRefresh } =
              freshAuthData;
            const retryHeaders = new Headers(request.headers);
            retryHeaders.set("Authorization", `Bearer ${newAccess}`);
            retryHeaders.set("refresh_token", newRefresh);

            try {
              const retryResponse = await fetchWithTimeout(request.url, {
                method: request.method,
                headers: retryHeaders,
                body:
                  request.method !== "GET" && request.method !== "HEAD"
                    ? request.body
                    : undefined,
              });

              if (retryResponse.status !== 401) {
                logger.debug("Retry after refresh succeeded");
                return retryResponse;
              }
            } catch (error) {
              // The retry itself couldn't reach the server. Again, no evidence
              // of a bad session — keep the tokens.
              if (isNetworkError(error)) {
                logger.warn("Retry after refresh unreachable, keeping session");
                return response;
              }
              throw error;
            }
          }
        }
      }

      // We got a 401, reached the refresh endpoint, and it still said no.
      // This is a genuine auth failure, so clearing tokens is correct.
      if (onUnauthorized) {
        logger.warn("Auth refresh exhausted, triggering logout");
        tokens.clear();
        onUnauthorized();
      }

      return response;
    }

    // Handle token refresh in response headers (server-side middleware refreshed for us)
    const access_token = response.headers.get("access_token");
    const refresh_token = response.headers.get("refresh_token");

    if (access_token && refresh_token) {
      logger.debug("Saving refreshed tokens from response headers");
      tokens.set({ access_token, refresh_token });
    } else if (access_token || refresh_token) {
      logger.warn("Incomplete token pair in response headers", {
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
      });
    }

    return response;
  },
});

export default client;
