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

export const RingUpdateProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const queryClient = useQueryClient();
    const [currentDelta, setCurrentDelta] = useState<RingDelta | null>(null);
    const queueRef = useRef<RingDelta[]>([]);
    const isAnimatingRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
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
            queueRef.current.push(delta);
            if (!isAnimatingRef.current) startNext();
        },
        [applyOptimisticUpdate, startNext]
    );

    const onAnimationComplete = useCallback(() => {
        // Tiny gap between consecutive animations so they don't feel mashed together.
        setTimeout(() => {
            if (mountedRef.current) startNext();
        }, 120);
    }, [startNext]);

    return (
        <RingUpdateContext.Provider
            value={{ currentDelta, showRingUpdate, onAnimationComplete }}
        >
            {children}
        </RingUpdateContext.Provider>
    );
};
