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
        console.log("🚀 Making request to:", request.url);
        console.log("🚀 Request method:", request.method);
        console.log("🚀 Request headers:", Object.fromEntries(request.headers.entries()));

        try {
            const authData = await SecureStore.getItemAsync("auth_data");

            if (authData) {
                const parsed = JSON.parse(authData);

                const { access_token, refresh_token } = parsed;
                if (access_token) {
                    request.headers.set("Authorization", `Bearer ${access_token}`);
                } else {
                    console.log("No access token found");
                }

                if (refresh_token) {
                    request.headers.set("refresh_token", refresh_token);
                } else {
                    console.log("No refresh token found");
                }
            } else {
                console.log("No auth data found for request");
            }
        } catch (error) {
            console.error("Error in request interceptor:", error);
        }

        request.headers.set("Content-Type", "application/json");
        
        console.log("🚀 Final request headers:", Object.fromEntries(request.headers.entries()));
        
        return request;
    },

    async onResponse({ response, request }) {
        // Handle token refresh in headers
        const access_token = response.headers.get("access_token");
        const refresh_token = response.headers.get("refresh_token");

        if (access_token && refresh_token) {
            console.log("📦 Saving tokens from response headers");
            const authData = {
                access_token: access_token,
                refresh_token: refresh_token,
            };

            await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));
            console.log("✅ Tokens saved successfully");

            // Verify what was actually saved
            const savedData = await SecureStore.getItemAsync("auth_data");
            console.log("🔍 Verified saved data:", savedData ? "Tokens exist" : "Save failed");

            // Update axios defaults for compatibility with existing code
            axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
            axios.defaults.headers.common["refresh_token"] = refresh_token;
        } else if (access_token || refresh_token) {
            console.warn("⚠️ Incomplete token pair in response headers");
            console.warn("⚠️ Access token:", access_token ? "exists" : "missing");
            console.warn("⚠️ Refresh token:", refresh_token ? "exists" : "missing");
        }

        return response;
    },
});

export default baseClient;
