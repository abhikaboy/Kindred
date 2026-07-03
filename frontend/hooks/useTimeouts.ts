import { useCallback, useEffect, useRef } from "react";

/**
 * setTimeout that auto-clears every pending timer on unmount — including
 * nested timers scheduled from inside other timer callbacks, which
 * effect-local cleanup misses.
 */
// ponytail: fired IDs accumulate until unmount; prune if a long-lived screen schedules thousands
export function useTimeouts() {
    const ids = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        return () => {
            ids.current.forEach(clearTimeout);
            ids.current = [];
        };
    }, []);

    return useCallback((fn: () => void, ms: number) => {
        const id = setTimeout(fn, ms);
        ids.current.push(id);
        return id;
    }, []);
}
