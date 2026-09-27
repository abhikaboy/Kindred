import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { guestTutorialDoneKey } from "@/constants/authStorageKeys";
import { createLogger } from "@/utils/logger";

const logger = createLogger("GuestEntry");

export const TABS_ROUTE: Href = "/(logged-in)/(tabs)/(task)";
export const GUEST_TUTORIAL_ROUTE: Href = "/(onboarding)/tutorial";

/** Where a guest belongs: the tutorial until they have finished it, then the app. */
export async function routeForGuest(userId: string): Promise<Href> {
    try {
        const done = await AsyncStorage.getItem(guestTutorialDoneKey(userId));
        return done === "true" ? TABS_ROUTE : GUEST_TUTORIAL_ROUTE;
    } catch {
        return GUEST_TUTORIAL_ROUTE;
    }
}

/**
 * First launch with no account: create a guest and pick its route. Falls back
 * to /login when the guest can't be created (offline, server error) so the
 * user still has a way in and can retry.
 */
export async function enterAsNewGuest(startGuestSession: () => Promise<{ _id: string }>): Promise<Href> {
    try {
        const guest = await startGuestSession();
        return await routeForGuest(guest._id);
    } catch (error) {
        logger.error("Guest session could not be created, falling back to login", error);
        return "/login";
    }
}
