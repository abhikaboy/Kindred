import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Dev override: hints reappear every mount (dismissals aren't persisted).
// Flip to false to test the real one-time behavior; no effect in release builds.
const ALWAYS_SHOW_HINTS = __DEV__ && true;

// One hint app-wide at a time. Losers don't queue — they re-attempt on their
// next mount, so a screen with several hints teaches one per visit.
let activeHintKey: string | null = null;

/**
 * One-time feature hint gate. `ready` is true only until `done()` is called
 * (persisted per install under hint_<key>).
 */
export function useFirstTouchHint(key: string) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;
        let claimed = false;

        const attempt = () => {
            if (!mounted || (activeHintKey !== null && activeHintKey !== key)) return;
            activeHintKey = key;
            claimed = true;
            setReady(true);
        };

        if (ALWAYS_SHOW_HINTS) {
            attempt();
        } else {
            AsyncStorage.getItem(`hint_${key}`).then((v) => {
                if (v !== "1") attempt();
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
        if (!ALWAYS_SHOW_HINTS) AsyncStorage.setItem(`hint_${key}`, "1").catch(() => {});
    }, [key]);

    return { ready, done };
}
