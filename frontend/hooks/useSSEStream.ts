import { useCallback, useRef, useState } from "react";
import { fetchSSEStream, type SSEEvent, type SSEStatusData, type SSEErrorData } from "@/api/stream";

export interface SSEStreamState<TResult> {
    stage: string | null;
    message: string | null;
    result: TResult | null;
    error: string | null;
    isStreaming: boolean;
}

/**
 * Generic hook for consuming an SSE streaming endpoint.
 * Returns state that updates as events arrive, and a start function.
 */
export function useSSEStream<TResult>() {
    const [stage, setStage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [result, setResult] = useState<TResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const start = useCallback(
        async (path: string, body: Record<string, unknown>): Promise<TResult | null> => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setStage(null);
            setMessage(null);
            setResult(null);
            setError(null);
            setIsStreaming(true);

            let finalResult: TResult | null = null;

            try {
                await fetchSSEStream(
                    path,
                    body,
                    (event: SSEEvent) => {
                        switch (event.type) {
                            case "status":
                            case "tool_call":
                            case "generating": {
                                const d = event.data as SSEStatusData;
                                setStage(d.stage);
                                setMessage(d.message);
                                break;
                            }
                            case "result":
                                finalResult = event.data as TResult;
                                setResult(finalResult);
                                break;
                            case "error": {
                                const d = event.data as SSEErrorData;
                                setError(d.message);
                                break;
                            }
                        }
                    },
                    controller.signal,
                );
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== "AbortError") {
                    setError(err.message);
                }
            } finally {
                setIsStreaming(false);
                abortRef.current = null;
            }

            return finalResult;
        },
        [],
    );

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setStage(null);
        setMessage(null);
        setResult(null);
        setError(null);
        setIsStreaming(false);
    }, []);

    return { stage, message, result, error, isStreaming, start, cancel, reset };
}
