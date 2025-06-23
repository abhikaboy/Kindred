import createClient from "openapi-fetch";
import type { paths } from "./generated/types";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

// Create the base client
const baseClient = createClient<paths>({
    baseUrl: process.env.EXPO_PUBLIC_API_URL || "",
});

// Add request interceptor for authentication
baseClient.use({
    async onRequest({ request }) {
        const authData = await SecureStore.getItemAsync("authData");
        if (authData) {
            const { access_token } = JSON.parse(authData);
            if (access_token) {
                request.headers.set("Authorization", `Bearer ${access_token}`);
            }
        }
        request.headers.set("Content-Type", "application/json");
        return request;
    },

    async onResponse({ response, request }) {
        // Handle token refresh in headers
        const access_token = response.headers.get("access_token");
        const refresh_token = response.headers.get("refresh_token");

        if (access_token || refresh_token) {
            const authData = {
                access_token: access_token || undefined,
                refresh_token: refresh_token || undefined,
            };

            await SecureStore.setItemAsync("authData", JSON.stringify(authData));

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
