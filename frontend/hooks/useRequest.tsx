import axios from "axios";
import * as SecureStore from "expo-secure-store";

let history = [];
let errorHistory = [];

function setRequestHistory(newHistory: any[]) {
    console.log("Adding To History!");
    history = newHistory;
}

function setErrorHistory(history: any[]) {
    console.log("Adding To Error History!");
    errorHistory = history;
}

function getHistory() {
    return history;
}

function getErrorHistory() {
    return errorHistory;
}

async function request(method: string, url: string, body?: any) {
    console.log(
        "Method: " + method + " URL: " + process.env.EXPO_PUBLIC_URL + url + " Body: " + JSON.stringify(body)
    );
    console.log("🔍 DEBUG - Request body type:", typeof body);
    console.log("🔍 DEBUG - Request body keys:", body ? Object.keys(body) : 'no body');
    console.log("🔍 DEBUG - Request body stringified:", JSON.stringify(body, null, 2));
    
    // Get auth data from SecureStore and prepare headers
    let headers: any = {
        "Content-Type": "application/json",
    };
    
    try {
        const authData = await SecureStore.getItemAsync("auth_data");
        if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed.access_token) {
                headers["Authorization"] = `Bearer ${parsed.access_token}`;
            }
            if (parsed.refresh_token) {
                headers["refresh_token"] = parsed.refresh_token;
            }
        }
    } catch (error) {
        console.log("Error getting auth data for request:", error);
    }
    
    try {
        const axiosConfig = {
            url: process.env.EXPO_PUBLIC_URL + "/api/v1" + url,
            method: method,
            headers: headers,
            data: body,
        };
        console.log("🚀 DEBUG - Axios config:", JSON.stringify(axiosConfig, null, 2));
        let response = await axios(axiosConfig);

        // console.log("Response: " + JSON.stringify(response.data));

        // Handle successful response
        const access_response = response.headers["access_token"];
        const refresh_response = response.headers["refresh_token"];

        if (access_response) {
            axios.defaults.headers.common["Authorization"] = "Bearer " + access_response;
        } else {
            console.log("Access token not found in response");
        }

        if (refresh_response) {
            axios.defaults.headers.common["refresh_token"] = refresh_response;
        } else {
            console.log("Refresh token not found in response");
        }
        // Only save auth data if we actually received new tokens
        if (access_response || refresh_response) {
            const authData = {
                access_token: access_response,
                refresh_token: refresh_response,
            };
            await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));
        }

        // Update request history only for successful requests
        setRequestHistory([
            ...history,
            {
                url: url,
                method: method,
                data: response.data,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            },
        ]);

        console.log("Request Successful!");
        return response.data;
    } catch (error) {
        console.log("Request Failed!");
        console.log("Error: " + (error.response?.statusText || error.message));
        console.log("Error Data: " + JSON.stringify(error.response?.data || {}));

        // Update error history
        setErrorHistory([...errorHistory, error.response || error]);

        // Throw a more descriptive error
        throw new Error(
            `Request failed: ${error.response?.statusText || error.message}. ` +
                `Status: ${error.response?.status || "Unknown"}. ` +
                `Details: ${JSON.stringify(error.response?.data || {})}`
        );
    }
}

// Import the new typed client
import { client } from "./useTypedAPI";
import type { paths } from "@/api/generated/types";

// Type-safe request method using openapi-fetch
async function typedRequest<TPath extends keyof paths, TMethod extends keyof paths[TPath]>(
    path: TPath,
    method: TMethod,
    // @ts-ignore - Complex type inference, but works at runtime
    options?: paths[TPath][TMethod] extends { requestBody: { content: { "application/json": infer T } } }
        ? { body: T }
        : { body?: never }
) {
    try {
        // @ts-ignore - Complex type inference
        const response = await client[method.toString().toUpperCase()](path, options);

        if (response.error) {
            throw new Error(`API Error: ${JSON.stringify(response.error)}`);
        }

        return response.data;
    } catch (error) {
        console.log("Typed Request Failed!", error);
        throw error;
    }
}

export const useRequest = () => {
    return {
        request: request,
        typedRequest: typedRequest,
        history: getHistory,
        errorHistory: getErrorHistory,
    };
};
