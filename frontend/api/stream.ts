import * as SecureStore from "expo-secure-store";

const BASE_URL = (process.env.EXPO_PUBLIC_URL ?? "") + "/api";

export type SSEEventType = "status" | "tool_call" | "generating" | "result" | "error";

export interface SSEStatusData {
    stage: string;
    message: string;
}

export interface SSEErrorData {
    message: string;
}

export interface SSEEvent<T = unknown> {
    type: SSEEventType;
    data: T;
}

/**
 * POST to an SSE endpoint and call onEvent for each parsed SSE frame.
 * Returns a promise that resolves when the stream closes.
 */
export async function fetchSSEStream<TResult>(
    path: string,
    body: Record<string, unknown>,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal,
): Promise<void> {
    const authData = await SecureStore.getItemAsync("auth_data");
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (authData) {
        const { access_token, refresh_token } = JSON.parse(authData);
        if (access_token) headers["Authorization"] = `Bearer ${access_token}`;
        if (refresh_token) headers["refresh_token"] = refresh_token;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
            if (!frame.trim()) continue;

            let eventType = "message";
            let data = "";

            for (const line of frame.split("\n")) {
                if (line.startsWith("event: ")) {
                    eventType = line.slice(7).trim();
                } else if (line.startsWith("data: ")) {
                    data = line.slice(6);
                }
            }

            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    onEvent({ type: eventType as SSEEventType, data: parsed });
                } catch {
                    // Skip malformed frames
                }
            }
        }
    }
}
