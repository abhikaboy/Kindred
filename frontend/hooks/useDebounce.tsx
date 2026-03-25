import { useLayoutEffect, useRef, useMemo, useEffect } from "react";

export const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
    const callbackRef = useRef(callback);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useLayoutEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    return useMemo(
        () =>
            (...args: any[]) => {
                if (timerRef.current !== null) {
                    clearTimeout(timerRef.current);
                }
                timerRef.current = setTimeout(() => {
                    callbackRef.current(...args);
                }, delay);
            },
        [delay]
    );
};
