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

        try {
            const authData = await SecureStore.getItemAsync("auth_data");

            if (authData) {
                const parsed = JSON.parse(authData);


                const { access_token, refresh_token } = parsed;
                if (access_token) {
                    request.headers.set("Authorization", `Bearer ${access_token}`);
                } else {
                }

                if (refresh_token) {
                    request.headers.set("refresh_token", refresh_token);
                } else {
                }
            } else {
            }
        } catch (error) {
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

            await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));

            // Verify what was actually saved
            const savedData = await SecureStore.getItemAsync("auth_data");

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
