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
        "Method: " + method + " URL: " + process.env.EXPO_PUBLIC_API_URL + url + " Body: " + JSON.stringify(body)
    );
    try {
        let response = await axios({
            url: process.env.EXPO_PUBLIC_API_URL + url,
            method: method,
            headers: {
                "Content-Type": "application/json",
            },
            data: body,
        });

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
        // set the new tokens in the secure storage in the authData object
        const authData = {
            access_token: access_response,
            refresh_token: refresh_response,
        };
        await SecureStore.setItemAsync("authData", JSON.stringify(authData));

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

export const useRequest = () => {
    return { request: request, history: getHistory, errorHistory: getErrorHistory };
};
