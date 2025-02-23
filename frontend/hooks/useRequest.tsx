import axios from "axios";

async function request(method: string, url: string, body?: any) {
    console.log(" Method: " + method + " URL: " + url + " Body: " + body);
    const response = await axios({
        url: process.env.EXPO_PUBLIC_API_URL + url,
        method: method,
        headers: {
            "Content-Type": "application/json",
        },
        data: body,
    });

    console.log(response);

    if (response.status > 299) {
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
    return { request: request };
};
