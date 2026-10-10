import type { Href } from "expo-router";
import { createLogger } from "@/utils/logger";

const logger = createLogger("GuestEntry");

export const TABS_ROUTE: Href = "/(logged-in)/(tabs)/(task)";

/** Guests land on Home, where onboarding v2 coaches them. */
export async function routeForGuest(_userId: string): Promise<Href> {
    return TABS_ROUTE;
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
