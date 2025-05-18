import { useEffect, useCallback, useRef } from "react";

export function useSafeAsync() {
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const safeAsync = useCallback(async (asyncFunction) => {
        try {
            const result = await asyncFunction();
            if (mountedRef.current) {
                return { result, error: null };
            }
            return { result: null, error: new Error("Component unmounted") };
        } catch (error) {
            if (mountedRef.current) {
                return { result: null, error };
            }
            return { result: null, error: new Error("Component unmounted") };
        }
    }, []);

    return safeAsync;
}
