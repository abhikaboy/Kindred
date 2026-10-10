import { useSyncExternalStore } from "react";

let scrolling = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const publish = (next: boolean) => {
    if (next === scrolling) return;
    scrolling = next;
    listeners.forEach((l) => l());
};

/** The page is moving under the coach: the spotlight and cue hide rather than trail their target. */
export function setCoachScrolling(next: boolean) {
    if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
    }
    publish(next);
}

/** A drag released: if momentum doesn't pick it up right away, the scroll is over. */
export function releaseCoachScrolling(graceMs = 120) {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
        settleTimer = null;
        publish(false);
    }, graceMs);
}

export function useCoachScrolling(): boolean {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => {
                listeners.delete(cb);
            };
        },
        () => scrolling,
        () => false
    );
}
