import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@/lib/api/types.gen";
import { RingUpdateOverlay } from "@/components/rings/RingUpdateOverlay";

export type RingDelta = components["schemas"]["RingDelta"];

type RingUpdateContextValue = {
  currentDelta: RingDelta | null;
  showRingUpdate: (delta?: RingDelta | null) => void;
  onAnimationComplete: () => void;
};

const RingUpdateContext = createContext<RingUpdateContextValue>({
  currentDelta: null,
  showRingUpdate: () => {},
  onAnimationComplete: () => {},
});

export const useRingUpdate = () => useContext(RingUpdateContext);

// Queues ring-fill animations and plays them one at a time; refreshes today's
// rings so the sidebar/floating widget reflect the new state.
export function RingUpdateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [currentDelta, setCurrentDelta] = useState<RingDelta | null>(null);
  const queue = useRef<RingDelta[]>([]);
  const animating = useRef(false);

  const refreshRings = useCallback(
    () => qc.invalidateQueries({ queryKey: ["get", "/v1/user/rings/today"] }),
    [qc]
  );

  const startNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next) {
      animating.current = false;
      setCurrentDelta(null);
      return;
    }
    animating.current = true;
    refreshRings();
    setCurrentDelta(next);
  }, [refreshRings]);

  const showRingUpdate = useCallback(
    (delta?: RingDelta | null) => {
      if (!delta) return;
      // Ring was already closed before this contribution — don't replay the
      // celebration, just keep the count fresh.
      if (delta.target > 0 && delta.previous >= delta.target) {
        refreshRings();
        return;
      }
      queue.current.push(delta);
      if (!animating.current) startNext();
    },
    [refreshRings, startNext]
  );

  const onAnimationComplete = useCallback(() => {
    window.setTimeout(startNext, 120);
  }, [startNext]);

  return (
    <RingUpdateContext.Provider value={{ currentDelta, showRingUpdate, onAnimationComplete }}>
      {children}
      <RingUpdateOverlay />
    </RingUpdateContext.Provider>
  );
}
