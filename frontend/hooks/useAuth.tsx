import { createContext, useContext, useEffect, useState, useRef } from "react";
import React from "react";
import * as SecureStore from "expo-secure-store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTypedMutation } from "@/hooks/useTypedAPI";
import { components } from "@/api/generated/types";
import { router } from "expo-router";
import client from "@/api/client";

// Use types from generated schema
type SafeUser = components["schemas"]["SafeUser"];
type LoginRequestApple = components["schemas"]["LoginRequestApple"];
type RegisterRequestApple = components["schemas"]["RegisterRequestApple"];

interface AuthData {
    access_token: string;
    refresh_token: string;
}

export async function saveAuthData(authData: AuthData): Promise<boolean> {
    try {
        console.log("Saving auth data!: ", authData);
        await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));
        return true;
    } catch (error) {
        console.error("Error saving auth data:", error);
        return false;
    }
}

export async function getAuthData(): Promise<AuthData | null> {
    console.warn("Requested Auth Data");
    try {
        const authDataString = await SecureStore.getItemAsync("auth_data");
        console.log("authDataString: ", authDataString);
        return authDataString ? JSON.parse(authDataString) : null;
    } catch (error) {
        console.error("Error retrieving auth data:", error);
        return null;
    }
}

// This function is now replaced by useAppleLoginMutation hook
interface AuthContextType {
    user: SafeUser | null;
    setUser: (user: SafeUser | null) => void;
    login: (appleAccountID: string) => Promise<SafeUser | void>;
    loginWithPhone: (phoneNumber: string, password: string) => Promise<SafeUser | void>;
    register: (email: string, appleAccountID: string) => Promise<any>;
    registerWithGoogle: (email: string, googleID: string) => Promise<any>;
    loginWithGoogle: (googleID: string) => Promise<SafeUser | void>;
    logout: () => void;
    refresh: () => void;
    fetchAuthData: () => Promise<SafeUser | null>;
    updateUser: (updates: Partial<SafeUser>) => void;
    isLoading: boolean;
    isError: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SafeUser | null>(null);
    const queryClient = useQueryClient();

    // Add these for rate limiting
    const lastFetchTime = useRef<number>(0);
    const fetchPromiseRef = useRef<Promise<any> | null>(null);

    // Apple login mutation
    const appleLoginMutation = useTypedMutation("post", "/v1/auth/login/apple");

    // Apple register mutation  
    const appleRegisterMutation = useTypedMutation("post", "/v1/auth/register/apple");

    // Google login and register mutations
    const googleLoginMutation = useTypedMutation("post", "/v1/auth/login/google" as any);
    const googleRegisterMutation = useTypedMutation("post", "/v1/auth/register/google" as any);

    // Login with token query - we'll use this for automatic authentication
    const loginWithTokenMutation = useTypedMutation("post", "/v1/user/login");

    // NOTE: This is a legacy function kept for backward compatibility with old components
    // New code should use the mutations directly from useOnboarding
    async function register(email: string, appleAccountID: string): Promise<any> {
        // @ts-ignore - Legacy function with incomplete type signature
        try {
            const result = await appleRegisterMutation.mutateAsync({
                body: {
                    apple_id: appleAccountID,
                    email: email,
                    // These fields should be provided by the caller but aren't in the old signature
                    display_name: '',
                    handle: '',
                    profile_picture: '',
                }
            });

            console.log("Registration successful:", result);
            return result;
        } catch (error) {
            console.error("Registration failed:", error);
            alert("Unable to complete registration. Please try again.");
            throw error;
        }
    }

    async function registerWithGoogle(email: string, googleID: string): Promise<any> {
        try {
            const result = await googleRegisterMutation.mutateAsync({
                body: {
                    google_id: googleID,
                    email: email,
                } as any
            });

            console.log("Google registration successful:", result);
            return result;
        } catch (error) {
            console.error("Google registration failed:", error);
            throw error;
        }
    }

    async function login(appleAccountID: string): Promise<SafeUser | void> {
        console.log(appleAccountID);
        console.log("Logging in...");
        console.log(process.env.EXPO_PUBLIC_URL + "/api")
        console.log(process.env.EXPO_PUBLIC_URL + "/api/v1/auth/login/apple")
        
        try {
            console.log("About to make POST request...");
            console.log("Request body:", { apple_id: appleAccountID });
            
            const result = await client.POST("/v1/auth/login/apple", {
                body: {
                    apple_id: appleAccountID,
                }
            });

            console.log("Raw result from client.POST:", result);
            console.log("Result data:", result.data);
            console.log("Result error:", result.error);
            console.log("Result response:", result.response);
            
            if (result.error) {
                console.log("Error details:", JSON.stringify(result.error, null, 2));
                
                // Check if this is a "account doesn't exist" error (404)
                const errorDetail = result.error?.detail || '';
                const errorStatus = result.response?.status;
                
                if (errorStatus === 404 || errorDetail.includes('Account does not exist')) {
                    // User-friendly error for account not found
                    throw new Error("ACCOUNT_NOT_FOUND");
                }
                
                // For other errors, provide a generic message
                throw new Error(`Login failed: ${errorDetail || 'An unexpected error occurred'}`);
            }
            
            if (result.data) {
                const userData = result.data as SafeUser;
                setUser(userData);
                
                // Save tokens if they exist in response headers
                console.log(result.response?.headers);
                if (result.response?.headers) {
                    const accessToken = result.response.headers.get('access_token');
                    const refreshToken = result.response.headers.get('refresh_token');
                    
                    if (accessToken && refreshToken) {
                        await saveAuthData({ 
                            access_token: accessToken, 
                            refresh_token: refreshToken 
                        });
                    }
                }
                
                return userData;
            }
            
            console.log("No data or error in response - this is unexpected");
        } catch (error) {
            console.error("Login failed with exception:", error);
            console.error("Error stack:", error.stack);
            throw error;
        }
    }

    async function loginWithGoogle(googleID: string): Promise<SafeUser | void> {
        console.log("Google login with ID:", googleID);
        
        try {
            console.log("About to make POST request to Google login endpoint...");
            console.log("Request body:", { google_id: googleID });
            
            const result = await client.POST("/v1/auth/login/google" as any, {
                body: {
                    google_id: googleID,
                } as any
            });

            console.log("Raw result from client.POST:", result);
            console.log("Result data:", result.data);
            console.log("Result error:", result.error);
            console.log("Result response:", result.response);
            
            if (result.error) {
                console.log("Error details:", JSON.stringify(result.error, null, 2));
                
                // Check if this is a "account doesn't exist" error (404)
                const errorDetail = result.error?.detail || '';
                const errorStatus = result.response?.status;
                
                if (errorStatus === 404 || errorDetail.includes('Account does not exist')) {
                    // User-friendly error for account not found
                    throw new Error("ACCOUNT_NOT_FOUND");
                }
                
                // For other errors, provide a generic message
                throw new Error(`Google login failed: ${errorDetail || 'An unexpected error occurred'}`);
            }
            
            if (result.data) {
                const userData = result.data as SafeUser;
                setUser(userData);
                
                // Save tokens if they exist in response headers
                console.log(result.response?.headers);
                if (result.response?.headers) {
                    const accessToken = result.response.headers.get('access_token');
                    const refreshToken = result.response.headers.get('refresh_token');
                    
                    if (accessToken && refreshToken) {
                        await saveAuthData({ 
                            access_token: accessToken, 
                            refresh_token: refreshToken 
                        });
                    }
                }
                
                return userData;
            }
            
            console.log("No data or error in response - this is unexpected");
        } catch (error) {
            console.error("Google login failed with exception:", error);
            console.error("Error stack:", error.stack);
            throw error;
        }
    }

    async function loginWithPhone(phoneNumber: string, password: string): Promise<SafeUser | void> {
        console.log("Phone login with number:", phoneNumber);
        
        try {
            console.log("About to make POST request to phone login endpoint...");
            console.log("Request body:", { phone_number: phoneNumber, password: "***" });
            
            const result = await client.POST("/v1/auth/login/phone" as any, {
                body: {
                    phone_number: phoneNumber,
                    password: password,
                } as any
            });

            console.log("Raw result from client.POST:", result);
            console.log("Result data:", result.data);
            console.log("Result error:", result.error);
            console.log("Result response:", result.response);
            
            if (result.error) {
                console.log("Error details:", JSON.stringify(result.error, null, 2));
                throw new Error(`Phone login failed: ${JSON.stringify(result.error)}`);
            }
            
            if (result.data) {
                const userData = result.data as SafeUser;
                setUser(userData);
                
                // Save tokens if they exist in response headers
                console.log(result.response?.headers);
                if (result.response?.headers) {
                    const accessToken = result.response.headers.get('access_token');
                    const refreshToken = result.response.headers.get('refresh_token');
                    
                    if (accessToken && refreshToken) {
                        await saveAuthData({ 
                            access_token: accessToken, 
                            refresh_token: refreshToken 
                        });
                    }
                }
                
                return userData;
            }
            
            console.log("No data or error in response - this is unexpected");
        } catch (error) {
            console.error("Phone login failed with exception:", error);
            console.error("Error stack:", error.stack);
            alert("Looks like we couldn't find your account, try to register instead!");
            throw error;
        }
    }

    function logout() {
        setUser(null);
        SecureStore.deleteItemAsync("auth_data");
        // Clear React Query cache
        queryClient.clear();
        console.log("logging out");
    }

    async function refresh() {
        if (user) {
            await fetchAuthData();
        }
    }

    async function fetchAuthData(): Promise<SafeUser | null> {
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchTime.current;

        // If there's an existing request in progress, return that promise
        if (fetchPromiseRef.current) {
            return fetchPromiseRef.current;
        }

        const rateLimit = 2000;
        if (timeSinceLastFetch < rateLimit) {
            const remainingTime = rateLimit - timeSinceLastFetch;
            console.log(`Rate limiting fetchAuthData, waiting ${remainingTime}ms before next call`);

            const promise = new Promise<SafeUser | null>((resolve) => {
                setTimeout(() => {
                    fetchPromiseRef.current = null;
                    resolve(fetchAuthData());
                }, remainingTime);
            });

            fetchPromiseRef.current = promise;
            return promise;
        }

        // Otherwise, execute the fetch
        console.warn("Authenticating with Saved Login");
        lastFetchTime.current = now;

        const fetchPromise = (async (): Promise<SafeUser | null> => {
            try {
                console.log("🔐 fetchAuthData: Step 1 - Getting stored auth tokens");
                const authData = await getAuthData();
                console.log("🔐 fetchAuthData: Auth data retrieved:", authData ? 'Tokens exist' : 'NO TOKENS');
                
                if (authData) {
                    console.log("🔐 fetchAuthData: Step 2 - Attempting token login");
                    console.log("🔐 Access token preview:", authData.access_token?.substring(0, 20) + '...');

                    try {
                        console.log("🔐 Making POST to /v1/user/login with Bearer token");
                        const result = await client.POST("/v1/user/login", {
                            params: {
                                header: {
                                    Authorization: `Bearer ${authData.access_token}`,
                                }
                            }
                        });
                        
                        console.log("🔐 Token login response received");
                        console.log("🔐 Has error:", !!result.error);
                        console.log("🔐 Has data:", !!result.data);
                        
                        if (result.error) {
                            console.error("❌ Token login failed with error:", JSON.stringify(result.error));
                            throw new Error(`Token login failed: ${JSON.stringify(result.error)}`);
                        }
                        
                        if (result.data) {
                            const userData = result.data as SafeUser;
                            console.log("✅ Token login successful!");
                            console.log("👤 User ID:", userData._id);
                            console.log("👤 Display name:", userData.display_name);
                            setUser(userData);
                            
                            // Update tokens if provided in response headers
                            if (result.response?.headers) {
                                const accessToken = result.response.headers.get('access_token');
                                const refreshToken = result.response.headers.get('refresh_token');
                                
                                if (accessToken && refreshToken) {
                                    console.log("🔄 Updating tokens from login response");
                                    await saveAuthData({ 
                                        access_token: accessToken, 
                                        refresh_token: refreshToken 
                                    });
                                }
                            }
                            
                            fetchPromiseRef.current = null;
                            return userData;
                        }
                        
                        console.error("❌ Token login returned no data and no error - unexpected state");
                    } catch (tokenError) {
                        console.error("❌ Token login exception:", tokenError);
                        console.error("❌ Error details:", tokenError.message);
                        logout();
                        return null;
                    }
                }

                console.warn("⚠️ No auth data found in storage, returning null");
                logout();
                return null;
            } catch (error) {
                console.error("Error fetching auth data:", error);
                logout();
                return null;
            }
        })();

        fetchPromiseRef.current = fetchPromise;
        return fetchPromise;
    }

    function updateUser(updates: Partial<SafeUser>) {
        setUser((prevUser) => prevUser ? ({ ...prevUser, ...updates }) : null);
    }

    return (
        <AuthContext.Provider 
            value={{ 
                user,
                setUser,
                register, 
                login,
                loginWithPhone,
                registerWithGoogle,
                loginWithGoogle,
                logout, 
                refresh, 
                fetchAuthData, 
                updateUser,
                isLoading: appleLoginMutation.isPending || appleRegisterMutation.isPending || googleLoginMutation.isPending || googleRegisterMutation.isPending || loginWithTokenMutation.isPending,
                isError: appleLoginMutation.isError || appleRegisterMutation.isError || googleLoginMutation.isError || googleRegisterMutation.isError || loginWithTokenMutation.isError
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
