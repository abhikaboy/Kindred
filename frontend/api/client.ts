import createClient from "openapi-fetch";
import type { paths } from "./generated/types";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { createLogger } from "@/utils/logger";

const logger = createLogger('API');

// Create the base client
const baseClient = createClient<paths>({
    baseUrl: process.env.EXPO_PUBLIC_URL + "/api" || "",
});

// Add request interceptor for authentication
baseClient.use({
    async onRequest({ request }) {
        logger.debug("Making request", {
            url: request.url,
            method: request.method
        });

        try {
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
        // Handle token refresh in headers
        const access_token = response.headers.get("access_token");
        const refresh_token = response.headers.get("refresh_token");

        if (access_token && refresh_token) {
            logger.debug("Saving tokens from response headers");
            const authData = {
                access_token: access_token,
                refresh_token: refresh_token,
            };

            await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));
            logger.debug("Tokens saved successfully");

            // Verify what was actually saved
            const savedData = await SecureStore.getItemAsync("auth_data");
            logger.debug("Verified saved data", { exists: !!savedData });

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
