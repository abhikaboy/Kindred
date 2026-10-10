import { useSyncExternalStore } from "react";

export type CoachRingKey = "plan" | "do" | "share";

let ring: CoachRingKey | null = null;
const listeners = new Set<() => void>();

/** The ring the coach is explaining, or null. The rings card dims the other two. */
export function setCoachRing(next: CoachRingKey | null) {
    if (next === ring) return;
    ring = next;
    listeners.forEach((l) => l());
}

export function useCoachRing(): CoachRingKey | null {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => {
                listeners.delete(cb);
            };
        },
        () => ring,
        () => null
    );
}
