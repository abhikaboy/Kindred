import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { createLogger } from "@/utils/logger";
import { reportReachable, reportUnreachable } from "@/utils/netStatus";
const logger = createLogger('Request');

/** Matches the openapi-fetch client's budget in `@/api/client`. */
const REQUEST_TIMEOUT_MS = 8_000;

async function request(method: string, url: string, body?: any) {
    logger.debug("Request", { method, url });

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
        logger.error("Error getting auth data for request:", error);
    }

    try {
        const axiosConfig = {
            url: process.env.EXPO_PUBLIC_URL + "/api/v1" + url,
            method: method,
            headers: headers,
            data: body,
            // Without this, a dead connection hangs on the platform default
            // instead of failing fast.
            timeout: REQUEST_TIMEOUT_MS,
        };
        let response = await axios(axiosConfig);
        reportReachable();

        const access_response = response.headers["access_token"];
        const refresh_response = response.headers["refresh_token"];

        if (access_response) {
            axios.defaults.headers.common["Authorization"] = "Bearer " + access_response;
        }

        if (refresh_response) {
            axios.defaults.headers.common["refresh_token"] = refresh_response;
        }

        if (access_response || refresh_response) {
            const authData = {
                access_token: access_response,
                refresh_token: refresh_response,
            };
            await SecureStore.setItemAsync("auth_data", JSON.stringify(authData));
        }

        return response.data;
    } catch (error) {
        const status = error.response?.status;

        // No response at all means we never reached the server — a timeout,
        // DNS failure, or dropped connection. Callers must be able to tell that
        // apart from a real status code, so keep it off the message and on the
        // error object.
        const offline = !error.response;
        if (offline) reportUnreachable();

        logger.error("Request Failed", {
            status,
            offline,
            message: error.response?.statusText || error.message,
        });

        const wrapped = new Error(
            offline
                ? `Request failed: could not reach the server (${error.message})`
                : `Request failed: ${error.response?.statusText || error.message}. ` +
                      `Status: ${status}. ` +
                      `Details: ${JSON.stringify(error.response?.data || {})}`
        ) as Error & { status?: number; isNetworkError?: boolean };
        wrapped.status = status;
        wrapped.isNetworkError = offline;
        throw wrapped;
    }
}

import { client } from "./useTypedAPI";
import type { paths } from "@/api/generated/types";

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
        logger.error("Typed Request Failed!", error);
        throw error;
    }
}

export { request, typedRequest };

export const useRequest = () => {
    return {
        request: request,
        typedRequest: typedRequest,
    };
};
