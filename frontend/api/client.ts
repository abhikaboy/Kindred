import createClient from "openapi-fetch";
import type { paths } from "./generated/types";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { createLogger } from "@/utils/logger";

const logger = createLogger('API');

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
let refreshPromise: Promise<boolean> | null = null;

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
 * Returns true if refresh succeeded (new tokens saved).
 */
async function performRefresh(): Promise<boolean> {
    try {
        const authData = await SecureStore.getItemAsync("auth_data");
        if (!authData) return false;

        const { refresh_token } = JSON.parse(authData);
        if (!refresh_token) return false;

        logger.debug("Performing token refresh");

        const response = await fetch(
            (process.env.EXPO_PUBLIC_URL ?? "") + "/api/v1/auth/refresh",
            {
                method: "POST",
                headers: {
                    "refresh_token": refresh_token,
                    "Content-Type": "application/json",
                },
            }
        );

        if (response.status === 401) {
            logger.warn("Refresh failed: server returned 401");
            return false;
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
            return true;
        }

        return false;
    } catch (error) {
        logger.error("Token refresh error", error);
        return false;
    }
}

/**
 * Ensure we have a valid (non-expired) access token before making a request.
 * If the token is expired, triggers a refresh with a mutex so concurrent
 * callers share a single refresh attempt.
 */
async function ensureValidToken(): Promise<boolean> {
    const authData = await SecureStore.getItemAsync("auth_data");
    if (!authData) return false;

    const { access_token } = JSON.parse(authData);
    if (!access_token) return false;

    // Token still valid — no refresh needed
    if (!isTokenExpired(access_token)) return true;

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
                if (refreshed) {
                    // Retry the original request with new tokens
                    const freshAuthData = await SecureStore.getItemAsync("auth_data");
                    if (freshAuthData) {
                        const { access_token: newAccess, refresh_token: newRefresh } = JSON.parse(freshAuthData);
                        const retryHeaders = new Headers(request.headers);
                        retryHeaders.set("Authorization", `Bearer ${newAccess}`);
                        retryHeaders.set("refresh_token", newRefresh);

                        const retryResponse = await fetch(request.url, {
                            method: request.method,
                            headers: retryHeaders,
                            body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
                        });

                        if (retryResponse.status !== 401) {
                            logger.debug("Retry after refresh succeeded");
                            return retryResponse;
                        }
                    }
                }
            }

            // Refresh failed or no auth data — genuine auth failure
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
