import * as SecureStore from "expo-secure-store";

/**
 * Utility function to add auth headers to API request parameters
 * The Authorization header will be overridden by the client interceptor with the actual token
 * This is just to satisfy TypeScript types that require the header to be present
 */
export const withAuthHeaders = (params: any = {}) => ({
    ...params,
    header: { Authorization: "", ...(params.header || {}) },
});

/**
 * Debug function to check what auth data is stored in SecureStore
 * Call this function to see if tokens are properly stored
 */
export const debugAuthData = async () => {
    try {
        const authData = await SecureStore.getItemAsync("auth_data");
        console.log("🔍 DEBUG AUTH DATA:", authData);

        if (authData) {
            const parsed = JSON.parse(authData);
            console.log("🔍 PARSED DEBUG DATA:", {
                hasAccessToken: !!parsed.access_token,
                hasRefreshToken: !!parsed.refresh_token,
                accessTokenPreview: parsed.access_token ? `${parsed.access_token.substring(0, 20)}...` : null,
                refreshTokenPreview: parsed.refresh_token ? `${parsed.refresh_token.substring(0, 20)}...` : null,
            });
            return parsed;
        } else {
            console.log("❌ NO AUTH DATA FOUND IN STORE");
            return null;
        }
    } catch (error) {
        console.error("❌ ERROR READING AUTH DATA:", error);
        return null;
    }
};
