import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useIsGuest } from "@/hooks/useIsGuest";
import { promptAccountForSocial, type SocialSurface } from "@/hooks/useAccountOverlay";

/**
 * Shows the account overlay over a screen a guest has focused, after `delayMs`
 * so the screen is seen first. Leaving before the delay cancels it.
 */
export function useGuestAccountWall(surface: SocialSurface, { delayMs = 400, everyVisit = true } = {}) {
    const isGuest = useIsGuest();
    useFocusEffect(
        useCallback(() => {
            if (!isGuest) return;
            const timer = setTimeout(() => promptAccountForSocial(surface, undefined, { everyVisit }), delayMs);
            return () => clearTimeout(timer);
        }, [isGuest, surface, delayMs, everyVisit])
    );
}
