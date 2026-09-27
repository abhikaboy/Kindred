import { useSyncExternalStore } from "react";

// Window-space frame of the home header's focus-mode (moon) button, published
// by WelcomeHeader so the intro tour can spotlight the real button instead of
// guessing where it sits.
export type Rect = { x: number; y: number; width: number; height: number };

let rect: Rect | null = null;
const listeners = new Set<() => void>();

export function setFocusButtonRect(next: Rect) {
    if (rect && rect.x === next.x && rect.y === next.y && rect.width === next.width && rect.height === next.height) return;
    rect = next;
    listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useFocusButtonRect(): Rect | null {
    return useSyncExternalStore(subscribe, () => rect, () => rect);
}
