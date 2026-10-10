import type { RefObject } from "react";
import type { View } from "react-native";

export type CoachAnchorKey = "categoryAdd" | "taskAdd" | "firstTask" | "homeTab" | "workspacesHandle" | "workspaceCreate" | "rings" | "dock";
export type CoachAnchorFrame = { x: number; y: number; width: number; height: number };

const refs = new Map<CoachAnchorKey, RefObject<View | null>>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

/** Registers a view as a coach target; pass null to unregister. Returns a cleanup that only removes this ref. */
export function registerCoachAnchor(key: CoachAnchorKey, ref: RefObject<View | null> | null): () => void {
    if (ref) refs.set(key, ref);
    else refs.delete(key);
    notify();
    return () => {
        if (ref && refs.get(key) === ref) {
            refs.delete(key);
            notify();
        }
    };
}

/** Window frame of the registered view, or null when missing, unmeasurable, or sizeless. */
export function getCoachAnchorFrame(key: CoachAnchorKey): Promise<CoachAnchorFrame | null> {
    const node = refs.get(key)?.current;
    if (!node?.measureInWindow) return Promise.resolve(null);
    return new Promise((resolve) => {
        node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
    });
}

export function subscribeCoachAnchors(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Tells the coach a registered view may have moved, so it re-measures now. */
export function notifyCoachAnchorsMoved() {
    notify();
}
