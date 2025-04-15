import { LoginRequest, LoginResponse, RegisterRequest } from "./types";
import { useRequest } from "@/hooks/useRequest";

/**
 * Logs in a user
 * API: Makes POST request to authenticate user credentials
 * Frontend: The response contains user data that is stored in AuthContext
 * Note: Access and refresh tokens are handled by the request function
 * @param credentials - The user's login credentials
 */
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { request } = useRequest();
    return await request("POST", "/auth/login", credentials);
};

/**
 * Registers a new user
 * API: Makes POST request to create a new user account
 * Frontend: No direct state updates, typically redirects to login
 * @param credentials - The new user's registration data
 */
export const register = async (credentials: RegisterRequest): Promise<void> => {
    const { request } = useRequest();
    await request("POST", "/auth/register", credentials);
};
