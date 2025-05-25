import { LoginRequest, LoginResponse, RegisterRequest, User } from "./types";
import { useRequest } from "@/hooks/useRequest";

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
        const { request } = useRequest();
        return await request("POST", "/auth/login", credentials);
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
        const { request } = useRequest();
        return await request("POST", "/auth/register", credentials);
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
        const { request } = useRequest();
        console.log("logging in with token");
        return await request("POST", "/user/login");
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
        const { request } = useRequest();
        return await request("POST", "/user/pushtoken", { pushToken });
    } catch (error) {
        console.error("Push token update failed:", error);
        throw new Error("Failed to update push token. Please try again later.");
    }
};
