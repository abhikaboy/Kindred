import { useState, useLayoutEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Dev override: hints reappear every mount (dismissals aren't persisted).
// Flip to false to test the real one-time behavior; no effect in release builds.
const ALWAYS_SHOW_HINTS = __DEV__ && true;
// Full-screen intros that stay one-time even under the dev override: they pop a
// sheet on every mount, and their host cards remount constantly (pager, expand).
const DEV_OVERRIDE_EXEMPT = new Set(["productivity_score"]);
const alwaysShow = (key: string) => ALWAYS_SHOW_HINTS && !DEV_OVERRIDE_EXEMPT.has(key);

// One hint app-wide at a time. Losers don't queue — they re-attempt on their
// next mount, so a screen with several hints teaches one per visit.
let activeHintKey: string | null = null;

// Every hint key in the app, preloaded with one multiGet on first use so N hint
// instances don't each hit AsyncStorage. Unknown keys fall back to getItem.
const KNOWN_HINT_KEYS = [
    "swipe_actions",
    "drawer_workspaces",
    "planner_drag",
    "timeline_drag_create",
    "feed_notifications",
    "blueprints_intro",
    "fab_intro",
    "task_create_options",
    "home_hide_sections",
    "personal_workspaces",
    "memories_days",
    "productivity_score",
];

// key → true once the hint has been dismissed (persisted as hint_<key> = "1").
const doneCache = new Map<string, boolean>();
let preloadPromise: Promise<void> | null = null;

const preload = (): Promise<void> => {
    if (!preloadPromise) {
        preloadPromise = AsyncStorage.multiGet(KNOWN_HINT_KEYS.map((k) => `hint_${k}`))
            .then((pairs) => {
                pairs.forEach(([storageKey, value]) => {
                    doneCache.set(storageKey.slice("hint_".length), value === "1");
                });
            })
            .catch(() => {});
    }
    return preloadPromise;
};

const loadDone = async (key: string): Promise<boolean> => {
    if (doneCache.has(key)) return doneCache.get(key)!;
    await preload();
    if (!doneCache.has(key)) {
        const v = await AsyncStorage.getItem(`hint_${key}`).catch(() => null);
        doneCache.set(key, v === "1");
    }
    return doneCache.get(key)!;
};

/** Synchronous check: true only when the hint is known (cached) to be dismissed. */
export const isHintKnownDone = (key: string): boolean => !alwaysShow(key) && doneCache.get(key) === true;

// Whether this instance could show right now without waiting on storage.
const canShowSync = (key: string) =>
    (activeHintKey === null || activeHintKey === key) &&
    (alwaysShow(key) || doneCache.get(key) === false);

/**
 * One-time feature hint gate. `ready` is true only until `done()` is called
 * (persisted per install under hint_<key>).
 */
export function useFirstTouchHint(key: string) {
    // When the answer is already known (dev override or warm cache), start in
    // the final state instead of rendering once with false and again with true.
    const [ready, setReady] = useState(() => canShowSync(key));

    useLayoutEffect(() => {
        let mounted = true;
        let claimed = false;

        const attempt = () => {
            if (!mounted) return;
            if (activeHintKey !== null && activeHintKey !== key) {
                // Lost the claim to a hint that mounted in the same pass.
                setReady(false);
                return;
            }
            activeHintKey = key;
            claimed = true;
            setReady(true);
        };

        if (alwaysShow(key)) {
            attempt();
        } else if (doneCache.has(key)) {
            if (!doneCache.get(key)) attempt();
            else setReady(false);
        } else {
            loadDone(key).then((isDone) => {
                if (!isDone) attempt();
            });
        }

        return () => {
            mounted = false;
            if (claimed && activeHintKey === key) activeHintKey = null;
        };
    }, [key]);

    const done = useCallback(() => {
        setReady(false);
        if (activeHintKey === key) activeHintKey = null;
        if (!alwaysShow(key)) {
            doneCache.set(key, true);
            AsyncStorage.setItem(`hint_${key}`, "1").catch(() => {});
        }
    }, [key]);

    return { ready, done };
}
