import createClient from "openapi-fetch";
import type { paths } from "./generated/types";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { createLogger } from "@/utils/logger";
import { reportReachable, reportUnreachable } from "@/utils/netStatus";

const logger = createLogger('API');

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
 * Covers a thrown `fetch` (TypeError on RN and the web) and aborts from our own
 * request timeouts.
 */
export function isNetworkError(error: unknown): boolean {
    if (!error) return false;
    // The legacy axios path in `useRequest` tags its errors explicitly.
    if ((error as { isNetworkError?: boolean }).isNetworkError) return true;
    const name = (error as { name?: string }).name;
    if (name === "AbortError" || name === "TimeoutError") return true;
    if (error instanceof TypeError) return true;
    const message = (error as { message?: string }).message ?? "";
    return /network request failed|failed to fetch|network error|timeout/i.test(message);
}

/** Requests on the auth-critical path get a tighter budget — startup must not hang. */
const AUTH_TIMEOUT_MS = 4_000;
const DEFAULT_TIMEOUT_MS = 8_000;

function timeoutForUrl(url: string): number {
    return /\/(auth\/refresh|user\/login)$/.test(url) ? AUTH_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

/**
 * `fetch` with a per-request timeout that also keeps the connectivity store up
 * to date. Without this every request hangs on the platform default (~60s on
 * iOS), which is the "30 second timeout then logged out" the user sees.
 *
 * AbortController rather than `AbortSignal.timeout` for React Native support.
 */
export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs?: number
): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? timeoutForUrl(url));

    try {
        const response = await fetch(input, { ...init, signal: controller.signal });
        reportReachable();
        return response;
    } catch (error) {
        if (isNetworkError(error)) reportUnreachable();
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

// Logout handler registered by AuthProvider to handle 401s
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
    onUnauthorized = handler;
}

export function clearUnauthorizedHandler() {
    onUnauthorized = null;
}

// --- Token refresh infrastructure ---

// Mutex: only one refresh can happen at a time. Other requests wait for it.
let refreshPromise: Promise<RefreshResult> | null = null;

/**
 * Decode the `exp` claim from a JWT without a library.
 * Returns expiry as epoch milliseconds, or null if unparseable.
 */
function getTokenExpiry(token: string): number | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        // Handle base64url → base64
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = atob(base64);
        const claims = JSON.parse(json);
        return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
    } catch {
        return null;
    }
}

/**
 * Returns true if the token is expired or will expire within `bufferMs`.
 * Defaults to a 60-second buffer so we refresh proactively.
 */
function isTokenExpired(token: string, bufferMs = 60_000): boolean {
    const exp = getTokenExpiry(token);
    if (exp === null) return true;
    return Date.now() + bufferMs >= exp;
}

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
        const authData = await SecureStore.getItemAsync("auth_data");
        if (!authData) return "rejected";

        const { refresh_token } = JSON.parse(authData);
        if (!refresh_token) return "rejected";

        logger.debug("Performing token refresh");

        const response = await fetchWithTimeout(
            (process.env.EXPO_PUBLIC_URL ?? "") + "/api/v1/auth/refresh",
            {
                method: "POST",
                headers: {
                    "refresh_token": refresh_token,
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
            const newAuthData = { access_token: newAccess, refresh_token: newRefresh };
            await SecureStore.setItemAsync("auth_data", JSON.stringify(newAuthData));

            // Keep axios defaults in sync for legacy code
            axios.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;
            axios.defaults.headers.common["refresh_token"] = newRefresh;

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
    const authData = await SecureStore.getItemAsync("auth_data");
    if (!authData) return "rejected";

    const { access_token } = JSON.parse(authData);
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
const baseClient = createClient<paths>({
    baseUrl: (process.env.EXPO_PUBLIC_URL ?? "") + "/api",
    // Every request gets a deadline and feeds the connectivity store.
    fetch: (input: Request) => fetchWithTimeout(input),
});

// Add request/response interceptors
baseClient.use({
    async onRequest({ request }) {
        logger.debug("Making request", {
            url: request.url,
            method: request.method
        });

        try {
            // Proactively refresh if token is expired — prevents 401 race
            await ensureValidToken();

            const authData = await SecureStore.getItemAsync("auth_data");

            if (authData) {
                const parsed = JSON.parse(authData);

                const { access_token, refresh_token } = parsed;
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
            const authData = await SecureStore.getItemAsync("auth_data");

            if (authData) {
                const { access_token } = JSON.parse(authData);
                const requestToken = request.headers.get("Authorization")?.replace("Bearer ", "");

                // If the stored token differs from what this request used,
                // another request already refreshed. Don't log out.
                if (access_token && requestToken && access_token !== requestToken) {
                    logger.debug("401 on stale request — tokens already refreshed, skipping logout");
                    return response;
                }

                // Tokens match — force a refresh before giving up
                logger.debug("401 with current tokens, attempting refresh + retry");
                const refreshed = await performRefresh();

                // Couldn't reach the refresh endpoint. We have no evidence the
                // session is bad, so keep the tokens and let the caller see the
                // failure as a network error.
                if (refreshed === "offline") {
                    logger.warn("Refresh unreachable during 401 handling, keeping session");
                    return response;
                }

                if (refreshed === "ok") {
                    // Retry the original request with new tokens
                    const freshAuthData = await SecureStore.getItemAsync("auth_data");
                    if (freshAuthData) {
                        const { access_token: newAccess, refresh_token: newRefresh } = JSON.parse(freshAuthData);
                        const retryHeaders = new Headers(request.headers);
                        retryHeaders.set("Authorization", `Bearer ${newAccess}`);
                        retryHeaders.set("refresh_token", newRefresh);

                        try {
                            const retryResponse = await fetchWithTimeout(request.url, {
                                method: request.method,
                                headers: retryHeaders,
                                body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
                            });

                            if (retryResponse.status !== 401) {
                                logger.debug("Retry after refresh succeeded");
                                return retryResponse;
                            }
                        } catch (error) {
                            // The retry itself couldn't reach the server. Again,
                            // no evidence of a bad session — keep the tokens.
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
                await SecureStore.deleteItemAsync("auth_data");
                onUnauthorized();
            }

            return response;
        }

        // Handle token refresh in response headers (server-side middleware refreshed for us)
        const access_token = response.headers.get("access_token");
        const refresh_token = response.headers.get("refresh_token");

        if (access_token && refresh_token) {
            logger.debug("Saving refreshed tokens from response headers");
            const authData = {
                access_token: access_token,
                refresh_token: refresh_token,
            };

            await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));

            // Update axios defaults for compatibility with existing code
            axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
            axios.defaults.headers.common["refresh_token"] = refresh_token;
        } else if (access_token || refresh_token) {
            logger.warn("Incomplete token pair in response headers", {
                hasAccessToken: !!access_token,
                hasRefreshToken: !!refresh_token
            });
        }

        return response;
    },
});

export default baseClient;
