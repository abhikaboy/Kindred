import createClient from "openapi-fetch";
import type { paths } from "./generated/types";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

// Create the base client
const baseClient = createClient<paths>({
    baseUrl: process.env.EXPO_PUBLIC_URL + "/api" || "",
});

// Add request interceptor for authentication
baseClient.use({
    async onRequest({ request }) {
        console.log("🔍 CLIENT INTERCEPTOR: Starting request interception");
        console.log("🔍 REQUEST URL:", request.url);
        console.log("🔍 REQUEST METHOD:", request.method);

        // Log initial headers
        console.log("🔍 INITIAL HEADERS:", Object.fromEntries(request.headers.entries()));

        try {
            const authData = await SecureStore.getItemAsync("auth_data");
            console.log("🔍 AUTH DATA FROM STORE:", authData ? "Found" : "Not found");
            console.log("🔍 RAW AUTH DATA STRING:", authData);

            if (authData) {
                const parsed = JSON.parse(authData);
                console.log("🔍 PARSED AUTH DATA FULL OBJECT:", parsed);
                console.log("🔍 PARSED AUTH DATA KEYS:", Object.keys(parsed));
                console.log("🔍 ACCESS TOKEN VALUE:", parsed.access_token);
                console.log("🔍 REFRESH TOKEN VALUE:", parsed.refresh_token);
                console.log("🔍 PARSED AUTH DATA:", {
                    hasAccessToken: !!parsed.access_token,
                    hasRefreshToken: !!parsed.refresh_token,
                    accessTokenLength: parsed.access_token?.length || 0,
                    accessTokenType: typeof parsed.access_token,
                    refreshTokenType: typeof parsed.refresh_token,
                });

                const { access_token, refresh_token } = parsed;

                if (access_token) {
                    console.log("✅ SETTING AUTHORIZATION HEADER");
                    request.headers.set("Authorization", `Bearer ${access_token}`);
                    console.log("✅ AUTHORIZATION HEADER SET TO:", request.headers.get("Authorization"));
                } else {
                    console.log("❌ NO ACCESS TOKEN FOUND - VALUE IS:", access_token);
                }

                if (refresh_token) {
                    console.log("✅ SETTING REFRESH TOKEN HEADER");
                    request.headers.set("refresh_token", refresh_token);
                } else {
                    console.log("❌ NO REFRESH TOKEN FOUND - VALUE IS:", refresh_token);
                }
            } else {
                console.log("❌ NO AUTH DATA IN SECURE STORE");
            }
        } catch (error) {
            console.error("❌ ERROR RETRIEVING AUTH DATA:", error);
        }

        request.headers.set("Content-Type", "application/json");

        // Log final headers
        console.log("🔍 FINAL HEADERS:", Object.fromEntries(request.headers.entries()));

        return request;
    },

    async onResponse({ response, request }) {
        console.log("🔍 CLIENT INTERCEPTOR: Processing response");
        console.log("🔍 RESPONSE STATUS:", response.status);
        console.log("🔍 RESPONSE HEADERS:", Object.fromEntries(response.headers.entries()));

        // Handle token refresh in headers
        const access_token = response.headers.get("access_token");
        const refresh_token = response.headers.get("refresh_token");

        console.log("🔍 NEW TOKENS FROM RESPONSE:", {
            access_token: access_token,
            refresh_token: refresh_token,
        });

        if (access_token || refresh_token) {
            console.log("🔄 NEW TOKENS RECEIVED:", {
                hasNewAccessToken: !!access_token,
                hasNewRefreshToken: !!refresh_token,
            });

            const authData = {
                access_token: access_token || undefined,
                refresh_token: refresh_token || undefined,
            };

            console.log("🔍 ABOUT TO SAVE AUTH DATA:", authData);
            await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));
            console.log("✅ NEW TOKENS SAVED TO SECURE STORE");

            // Verify what was actually saved
            const savedData = await SecureStore.getItemAsync("auth_data");
            console.log("🔍 VERIFICATION - SAVED DATA:", savedData);

            // Update axios defaults for compatibility with existing code
            if (access_token) {
                axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
            }
            if (refresh_token) {
                axios.defaults.headers.common["refresh_token"] = refresh_token;
            }
        }

        return response;
    },
});

export default baseClient;
