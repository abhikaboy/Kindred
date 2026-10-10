import { useSyncExternalStore } from "react";

export type CoachSurface = { active: boolean; workspacePage: boolean };

const OFF: CoachSurface = { active: false, workspacePage: false };
let surface: CoachSurface = OFF;
const listeners = new Set<() => void>();

/** The task tab publishes whether the coach may show, and whether it is on a workspace page. */
export function setCoachSurface(next: CoachSurface) {
    if (next.active === surface.active && next.workspacePage === surface.workspacePage) return;
    surface = next;
    listeners.forEach((l) => l());
}

export function useCoachSurface(): CoachSurface {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => {
                listeners.delete(cb);
            };
        },
        () => surface,
        () => OFF
    );
}
