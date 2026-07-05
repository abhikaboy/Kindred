import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Dev override: hints reappear every mount (dismissals aren't persisted).
// Flip to false to test the real one-time behavior; no effect in release builds.
const ALWAYS_SHOW_HINTS = __DEV__ && true;

/**
 * One-time feature hint gate. `ready` is true only until `done()` is called
 * (persisted per install under hint_<key>).
 */
export function useFirstTouchHint(key: string) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (ALWAYS_SHOW_HINTS) {
            setReady(true);
            return;
        }
        let mounted = true;
        AsyncStorage.getItem(`hint_${key}`).then((v) => {
            if (mounted && v !== "1") setReady(true);
        });
        return () => {
            mounted = false;
        };
    }, [key]);

    const done = useCallback(() => {
        setReady(false);
        if (!ALWAYS_SHOW_HINTS) AsyncStorage.setItem(`hint_${key}`, "1").catch(() => {});
    }, [key]);

    return { ready, done };
}
