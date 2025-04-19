import axios from "axios";

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
    console.log("Method: " + method + " URL: " + url + " Body: " + JSON.stringify(body));
    let response = await axios({
        url: process.env.EXPO_PUBLIC_API_URL + url,
        method: method,
        headers: {
            "Content-Type": "application/json",
        },
        data: body,
    });
    console.log("After");
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
    console.log("Response: " + JSON.stringify(response.data));
    if (response.status > 299) {
        console.log("Error: " + response.statusText);
        console.log("Error Data: " + JSON.stringify(response.data));
        setErrorHistory([...errorHistory, response]);
        // Theres an error
        throw Error("Unable to complete operation" + " status codey: " + response.statusText);
    } else {
        const access_response = response.headers["access_token"];
        const refresh_response = response.headers["refresh_token"];
        if (!access_response) {
            console.log("Access token not found in response");
        } else {
            axios.defaults.headers.common["Authorization"] = "Bearer " + access_response;
        }
        if (!refresh_response) {
            console.log("Refresh token not found in response");
        } else {
            axios.defaults.headers.common["refresh_token"] = refresh_response;
        }
    }
    return response.data;
}

export const useRequest = () => {
    return { request: request, history: getHistory, errorHistory: getErrorHistory };
};
