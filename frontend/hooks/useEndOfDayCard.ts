import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endOfDayDismissKey, isEndOfDayWindow } from "@/utils/endOfDay";

/**
 * Card is visible from END_OF_DAY_HOUR (8PM) through 6AM the next morning,
 * unless dismissed (or the review was completed) for that night. Re-checks
 * every minute so the card appears if the app stays open across the trigger hour.
 */
export const useEndOfDayCard = () => {
    // Start hidden until storage answers, so the card never flashes.
    const [dismissedToday, setDismissedToday] = useState(true);
    const [inWindow, setInWindow] = useState(() => isEndOfDayWindow(new Date()));

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            const now = new Date();
            const stored = await AsyncStorage.getItem(endOfDayDismissKey(now));
            if (cancelled) return;
            setInWindow(isEndOfDayWindow(now));
            setDismissedToday(stored != null);
        };
        check();
        const interval = setInterval(check, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const dismiss = useCallback(() => {
        setDismissedToday(true);
        AsyncStorage.setItem(endOfDayDismissKey(new Date()), "1").catch(() => {});
    }, []);

    return { visible: inWindow && !dismissedToday, dismiss };
};
