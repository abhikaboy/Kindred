import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * One-time feature hint gate. `ready` is true only until `done()` is called
 * (persisted per install under hint_<key>).
 */
export function useFirstTouchHint(key: string) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
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
        AsyncStorage.setItem(`hint_${key}`, "1").catch(() => {});
    }, [key]);

    return { ready, done };
}
