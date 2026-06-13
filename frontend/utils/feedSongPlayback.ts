import { useSyncExternalStore } from "react";

// Feed-wide "sound on" toggle (Instagram-style): off by default, tap any post's
// speaker to unmute. While on, the primary on-screen post's song autoplays.
let soundOn = false;
const soundListeners = new Set<() => void>();
export const feedSound = {
    get: () => soundOn,
    set: (v: boolean) => {
        if (v !== soundOn) {
            soundOn = v;
            soundListeners.forEach((l) => l());
        }
    },
    toggle: () => feedSound.set(!soundOn),
    subscribe: (l: () => void) => {
        soundListeners.add(l);
        return () => {
            soundListeners.delete(l);
        };
    },
};

export function useFeedSound() {
    const on = useSyncExternalStore(feedSound.subscribe, feedSound.get, feedSound.get);
    return { soundOn: on, toggleSound: feedSound.toggle };
}

// The post currently most-visible in the feed — drives which song autoplays.
let activePostId: string | null = null;
const activeListeners = new Set<() => void>();
export const feedActivePost = {
    get: () => activePostId,
    set: (id: string | null) => {
        if (id !== activePostId) {
            activePostId = id;
            activeListeners.forEach((l) => l());
        }
    },
    subscribe: (l: () => void) => {
        activeListeners.add(l);
        return () => {
            activeListeners.delete(l);
        };
    },
};

export function useIsActivePost(postId?: string) {
    const id = useSyncExternalStore(feedActivePost.subscribe, feedActivePost.get, feedActivePost.get);
    return !!postId && id === postId;
}
