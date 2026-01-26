import { LoginRequest, LoginResponse, RegisterRequest, User } from "./types";
import { client } from "@/hooks/useTypedAPI";
import { withAuthHeaders } from "./utils";

/**
 * Logs in a user
 * API: Makes POST request to authenticate user credentials
 * Frontend: The response contains user data that is stored in AuthContext
 * Note: Access and refresh tokens are handled by the request function
 * @param credentials - The user's login credentials
 * @throws {Error} When the request fails or credentials are invalid
 */
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
        const { data, error } = await client.POST("/v1/auth/login", {
            body: credentials,
        });

        if (error) {
            throw new Error(`Failed to login: ${JSON.stringify(error)}`);
        }

        return data;
    } catch (error) {
        // Log the error for debugging
        console.error("Login failed:", error);
        // Re-throw with a more user-friendly message
        throw new Error("Failed to login. Please check your credentials and try again.");
    }
};

/**
 * Registers a new user
 * API: Makes POST request to create a new user account
 * Frontend: No direct state updates, typically redirects to login
 * @param credentials - The new user's registration data
 * @throws {Error} When the request fails or registration data is invalid
 */
export const register = async (credentials: RegisterRequest): Promise<void> => {
    try {
        const { error } = await client.POST("/v1/auth/register", {
            body: credentials,
        });

        if (error) {
            throw new Error(`Failed to register: ${JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Registration failed:", error);
        throw new Error("Failed to register. Please try again later.");
    }
};

/**
 * Login with token
 * API: Makes POST request to authenticate user credentials
 * Note: Access and refresh tokens are handled by the request function
 * @throws {Error} When the token is invalid or request fails
 */
export const loginWithToken = async (): Promise<User> => {
    try {
        console.log("logging in with token");
        const { data, error } = await client.POST("/v1/user/login", {
            params: withAuthHeaders(),
        });

        if (error) {
            throw new Error(`Failed to login with token: ${JSON.stringify(error)}`);
        }

        return data;
    } catch (error) {
        console.error("Token login failed:", error);
        throw new Error("Session expired. Please login again.");
    }
};

/**
 * Update the push token for a user
 * API: Makes POST request to update the push token
 * @param pushToken - The new push token
 * @throws {Error} When the request fails or push token is invalid
 */
export const updatePushToken = async (pushToken: string): Promise<void> => {
    try {
        const { data, error } = await client.POST("/v1/user/pushtoken", {
            params: withAuthHeaders(),
            body: { push_token: pushToken },
        });

        if (error) {
            console.error("Push token update error:", error);
            throw new Error(`Failed to update push token: ${JSON.stringify(error)}`);
        }

        console.log("Push token updated successfully:", data);
    } catch (error) {
        console.error("Push token update failed:", error);
        throw error;
    }
};

/**
 * Delete the user's account
 * API: Makes DELETE request to permanently delete the user account and all associated data
 * @throws {Error} When the request fails
 */
export const deleteAccount = async (): Promise<void> => {
    try {
        const { error } = await client.DELETE("/v1/user/account", {
            params: withAuthHeaders(),
        });

        if (error) {
            throw new Error(`Failed to delete account: ${JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error("Account deletion failed:", error);
        throw new Error("Failed to delete account. Please try again later.");
    }
};

/**
 * Accept Terms of Service
 * API: Makes POST request to record user's acceptance of Terms of Service
 * @param termsVersion - Version of terms being accepted (e.g., "1.0")
 * @throws {Error} When the request fails
 */
export const acceptTerms = async (termsVersion: string = "1.0"): Promise<{
    message: string;
    terms_accepted_at: string;
    terms_version: string;
}> => {
    try {
        const { data, error } = await client.POST("/v1/user/accept-terms", {
            params: withAuthHeaders(),
            body: { terms_version: termsVersion },
        });

        if (error) {
            throw new Error(`Failed to accept terms: ${JSON.stringify(error)}`);
        }

        return data as any;
    } catch (error) {
        console.error("Terms acceptance failed:", error);
        throw new Error("Failed to accept terms. Please try again later.");
    }
};
