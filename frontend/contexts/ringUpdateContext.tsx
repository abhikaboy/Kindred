import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RingDelta, RingTodayResponse } from "@/api/types";

interface RingUpdateContextValue {
    currentDelta: RingDelta | null;
    showRingUpdate: (delta: RingDelta | undefined | null) => void;
    onAnimationComplete: () => void;
}

const RingUpdateContext = createContext<RingUpdateContextValue>({
    currentDelta: null,
    showRingUpdate: () => {},
    onAnimationComplete: () => {},
});

export const useRingUpdate = () => useContext(RingUpdateContext);

// Coalesce two same-ring deltas from rapid completions: keep the earliest
// starting point, take the latest end/target, and recompute the close flags
// across the merged span so the celebration still fires if the batch closed it.
function mergeDelta(a: RingDelta, b: RingDelta): RingDelta {
    return {
        ...b,
        previous: a.previous,
        just_closed: a.previous < b.target && b.current >= b.target,
        just_closed_all: b.all_closed && !a.all_closed,
    };
}

export const RingUpdateProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const queryClient = useQueryClient();
    const [currentDelta, setCurrentDelta] = useState<RingDelta | null>(null);
    const queueRef = useRef<RingDelta[]>([]);
    const isAnimatingRef = useRef(false);
    const mountedRef = useRef(true);
    const pendingRef = useRef<Map<string, RingDelta>>(new Map());
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        };
    }, []);

    const applyOptimisticUpdate = useCallback(
        (delta: RingDelta) => {
            queryClient.setQueryData<RingTodayResponse>(
                ["rings", "today"],
                (prev) => {
                    if (!prev?.ring_state) return prev;
                    const ringState = { ...prev.ring_state };
                    const ring = ringState[delta.ring];
                    if (!ring) return prev;
                    ringState[delta.ring] = {
                        ...ring,
                        current: delta.current,
                        target: delta.target,
                        closed: delta.just_closed || ring.closed,
                    };
                    return {
                        ...prev,
                        ring_state: {
                            ...ringState,
                            all_closed:
                                delta.all_closed || prev.ring_state.all_closed,
                        },
                    };
                }
            );
        },
        [queryClient]
    );

    const startNext = useCallback(() => {
        if (!mountedRef.current) return;
        const next = queueRef.current.shift();
        if (!next) {
            isAnimatingRef.current = false;
            setCurrentDelta(null);
            return;
        }
        isAnimatingRef.current = true;
        applyOptimisticUpdate(next);
        // The overlay handles haptics — heavy on ring close, nothing on a
        // routine increment. The call site that triggered the action already
        // fired its own response haptic.
        setCurrentDelta(next);
    }, [applyOptimisticUpdate]);

    // Drain the debounce buffer into the play queue as one delta per ring.
    const flush = useCallback(() => {
        flushTimerRef.current = null;
        if (!mountedRef.current) return;
        pendingRef.current.forEach((d) => queueRef.current.push(d));
        pendingRef.current.clear();
        if (!isAnimatingRef.current) startNext();
    }, [startNext]);

    const showRingUpdate = useCallback(
        (delta: RingDelta | undefined | null) => {
            if (!delta) return;
            // Ring was already closed before this contribution — the user has
            // already seen the close celebration today, so don't replay the
            // animation for additional progress on a closed ring. Still patch
            // the cache so the underlying count stays accurate.
            if (delta.target > 0 && delta.previous >= delta.target) {
                applyOptimisticUpdate(delta);
                return;
            }
            // Coalesce completions that land within 800ms into a single
            // animation that jumps by the total, rather than replaying the
            // fill once each.
            const existing = pendingRef.current.get(delta.ring);
            pendingRef.current.set(
                delta.ring,
                existing ? mergeDelta(existing, delta) : delta
            );
            if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
            flushTimerRef.current = setTimeout(flush, 800);
        },
        [applyOptimisticUpdate, flush]
    );

    const onAnimationComplete = useCallback(() => {
        // Tiny gap between consecutive animations so they don't feel mashed together.
        setTimeout(() => {
            if (mountedRef.current) startNext();
        }, 120);
    }, [startNext]);

    const value = React.useMemo(
        () => ({ currentDelta, showRingUpdate, onAnimationComplete }),
        [currentDelta, showRingUpdate, onAnimationComplete]
    );

    return (
        <RingUpdateContext.Provider value={value}>
            {children}
        </RingUpdateContext.Provider>
    );
};
