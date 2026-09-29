import { useSyncExternalStore } from "react";
import { getPendingGap, markGapHandled, subscribeLastOpen } from "@/utils/lastOpen";

/** Days away before Today offers the Welcome back sheet. */
export const WELCOME_BACK_GAP_DAYS = 4;

const snapshot = () => {
    const gap = getPendingGap();
    return gap && gap.days >= WELCOME_BACK_GAP_DAYS ? gap : null;
};

/** The unhandled return gap for this session, or null. */
export function useReturnGap() {
    const gap = useSyncExternalStore(subscribeLastOpen, snapshot);
    return { gap, markHandled: markGapHandled };
}
