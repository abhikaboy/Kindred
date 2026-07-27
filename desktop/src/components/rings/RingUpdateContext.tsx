import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@/lib/api/types.gen";
import { RingUpdateOverlay } from "@/components/rings/RingUpdateOverlay";

export type RingDelta = components["schemas"]["RingDelta"];

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
  const pending = useRef<Map<string, RingDelta>>(new Map());
  const flushTimer = useRef<number | null>(null);

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

  // Drain the debounce buffer into the play queue as one delta per ring.
  const flush = useCallback(() => {
    flushTimer.current = null;
    queue.current.push(...pending.current.values());
    pending.current.clear();
    if (!animating.current) startNext();
  }, [startNext]);

  const showRingUpdate = useCallback(
    (delta?: RingDelta | null) => {
      if (!delta) return;
      // Ring was already closed before this contribution — don't replay the
      // celebration, just keep the count fresh.
      if (delta.target > 0 && delta.previous >= delta.target) {
        refreshRings();
        return;
      }
      // Coalesce completions that land within 800ms into a single animation
      // that jumps by the total, rather than replaying the fill once each.
      const existing = pending.current.get(delta.ring);
      pending.current.set(delta.ring, existing ? mergeDelta(existing, delta) : delta);
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(flush, 800);
    },
    [refreshRings, flush]
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
