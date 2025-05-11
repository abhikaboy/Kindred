import { createContext, useContext, useEffect, useState } from "react";
import React from "react";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { loginWithToken } from "@/api/auth";
import { router } from "expo-router";

interface User {
    id: string;
    email: string;
    appleAccountID: string;
}

async function saveAuthData(authData) {
    try {
        await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));
        return true;
    } catch (error) {
        console.error("Error saving auth data:", error);
        return false;
    }
}

async function getAuthData() {
    try {
        const authDataString = await SecureStore.getItemAsync("auth_data");
        return authDataString ? JSON.parse(authDataString) : null;
    } catch (error) {
        console.error("Error retrieving auth data:", error);
        return null;
    }
}

async function getUserByAppleAccountID(appleAccountID: string): Promise<Error | User> {
    const url = process.env.EXPO_PUBLIC_API_URL + "/auth/login/apple";
    const response = await axios.post(url, {
        apple_id: appleAccountID,
    });

    // validate the response is okay
    if (response.status > 300) {
        // What was the error?
        console.log(response);
        // let res = response.data;
        alert(
            "Unable to complete operation" + " status code: " + response.statusText + " response: " + response.status
        );
        throw Error(
            "Unable to complete operation" + " status code: " + response.statusText + " response: " + response.status
        );
    }

    const access_token: string = response.headers["access_token"];
    const refresh_token: string = response.headers["refresh_token"];

    await saveAuthData({ access_token, refresh_token });

    axios.defaults.headers.common["Authorization"] = "Bearer " + access_token;
    axios.defaults.headers.common["refresh_token"] = refresh_token;

    const user = response.data;
    return user;
}

interface AuthContextType {
    user: any | null;
    login: (appleAccountID: string) => void;
    register: (email: string, appleAccountID: string) => any;
    logout: () => void;
    refresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any | null>(null);

    async function register(email: string, appleAccountID: string) {
        const url = process.env.EXPO_PUBLIC_API_URL;
        console.log(url);
        try {
            const response = await fetch(`${url}/auth/register/apple`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    apple_id: appleAccountID,
                    email: email,
                    password: appleAccountID,
                }),
            });

            let res = await response.json();
            if (!response.ok) {
                alert("Unable to complete operation" + " status code: " + res.body);
                throw Error("Unable to complete operation" + " status code: " + res.body);
            }
            return await response.json();
        } catch (e: any) {
            console.log(e);
        }
    }

    async function login(appleAccountID: string) {
        console.log(appleAccountID);
        console.log("Logging in...");
        const userRes = await getUserByAppleAccountID(appleAccountID);
        console.log(userRes);

        if (userRes) {
            setUser(userRes);
            // get the token and refresh token from the response
            return userRes;
        } else {
            alert("Looks like we couldn't find your account, try to register instead!");
            // Need more helpful error handling
            throw new Error("Could not login");
        }
    }

    function logout() {
        setUser(null);
        SecureStore.deleteItemAsync("auth_data");
        axios.defaults.headers.common["Authorization"] = "";
        axios.defaults.headers.common["refresh_token"] = "";
        console.log("logging out");
    }

    async function refresh() {
        if (user) {
            await login(user.appleAccountID);
        }
    }

    useEffect(() => {
        const fetchAuthData = async () => {
            console.log("fetching auth data pt 1");
            const authData = await getAuthData();
            console.log("authData: ", authData);
            if (authData) {
                // set the axios headers to use the auth data
                axios.defaults.headers.common["Authorization"] = "Bearer " + authData.access_token;
                axios.defaults.headers.common["refresh_token"] = authData.refresh_token;
                // make an api request
                console.log("fetching auth data pt 2");
                try {
                    const user = await loginWithToken();
                    setUser(user);
                } catch (error) {
                    console.log("Error: " + error);
                    logout();
                }
                console.warn("TING TING TIN");
                console.log("user auth provider: \n", user);
            } else {
                console.log("No auth data found");
                logout();
            }
        };
        fetchAuthData();
    }, []);

    return <AuthContext.Provider value={{ user, register, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
