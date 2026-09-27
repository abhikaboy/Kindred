import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountPromptFirstTaskKey, guestTutorialDoneKey } from "@/constants/authStorageKeys";
import { homeTourVisibilityEvents } from "@/utils/homeTourVisibilityEvents";

/**
 * Module-level store for the guest "create an account" overlay. A store rather
 * than a context so the triggers (task submit hooks, the tab bar, Home) can
 * reach it from anywhere, including code that also runs outside the signed-in
 * layout (the guest tutorial), without a provider to trip over.
 *
 * The overlay only ever shows while an AccountOverlay host is mounted, which
 * lives in the (logged-in) layout.
 */

export type AccountOverlayReason = "first-task" | "social" | "login-link";
export type SocialSurface = "feed" | "search" | "friends";
export type AccountOverlayDismissMethod = "scrim" | "not_now" | "back";

export type AccountOverlayRequest = {
    reason: AccountOverlayReason;
    surface?: SocialSurface;
    /** Runs when the user dismisses (not when they go on to sign up or log in). */
    onDismiss?: () => void;
};

type State = {
    visible: boolean;
    request: AccountOverlayRequest | null;
};

// Long enough to see the new task land before the overlay fades in.
export const FIRST_TASK_PROMPT_DELAY_MS = 1500;

let state: State = { visible: false, request: null };
const listeners = new Set<() => void>();

let hostCount = 0;
// A guest who has finished the tutorial. Kept in sync by the mounted host.
let eligible = false;
// A request made while the home tour is running waits for the tour to end.
let pending: AccountOverlayRequest | null = null;
let tourActive = false;
// Social surfaces already prompted this app session.
const promptedSurfaces = new Set<SocialSurface>();
// Guests whose first-task prompt is already scheduled or done in this session.
const firstTaskHandled = new Set<string>();

const setState = (next: State) => {
    state = next;
    listeners.forEach((fn) => fn());
};

const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};

const getSnapshot = () => state;

homeTourVisibilityEvents.subscribe((active) => {
    tourActive = active;
    if (!active && pending) {
        const next = pending;
        pending = null;
        present(next);
    }
});

function present(request: AccountOverlayRequest) {
    if (hostCount === 0) return;
    // One prompt at a time; the first reason wins.
    if (state.visible) return;
    if (tourActive) {
        pending = request;
        return;
    }
    setState({ visible: true, request });
}

export function openAccountOverlay(
    reason: AccountOverlayReason,
    options: Omit<AccountOverlayRequest, "reason"> = {}
) {
    present({ reason, ...options });
}

/** Hides the overlay without treating it as a dismissal (e.g. the user signed up). */
export function closeAccountOverlay() {
    pending = null;
    if (!state.visible) return;
    setState({ visible: false, request: state.request });
}

/** The user said "not now". Runs the request's onDismiss. */
export function dismissAccountOverlay() {
    if (!state.visible) return;
    const request = state.request;
    setState({ visible: false, request });
    request?.onDismiss?.();
}

/** Called by the AccountOverlay host. Returns the unregister function. */
export function registerAccountOverlayHost() {
    hostCount += 1;
    return () => {
        hostCount = Math.max(0, hostCount - 1);
        if (hostCount === 0) {
            eligible = false;
            closeAccountOverlay();
        }
    };
}

export function setAccountOverlayEligible(value: boolean) {
    eligible = value;
    if (!value) closeAccountOverlay();
}

/**
 * Social surfaces need an account. The first time per session a guest reaches
 * one, show the overlay instead. Returns true when it did, so the caller can
 * hold the navigation back.
 */
export function promptAccountForSocial(surface: SocialSurface, onDismiss?: () => void): boolean {
    if (!eligible || hostCount === 0 || state.visible || tourActive) return false;
    if (promptedSurfaces.has(surface)) return false;
    promptedSurfaces.add(surface);
    openAccountOverlay("social", { surface, onDismiss });
    return true;
}

/**
 * After a guest's first self-created task. Only once per guest (persisted), and
 * never for the tutorial's own task: the tutorial-done flag isn't set until the
 * tutorial finishes, and no host is mounted while it runs.
 */
export async function promptAccountAfterFirstTask(user?: { _id?: string; isGuest?: boolean } | null) {
    const userId = user?._id;
    if (!userId || !user?.isGuest || hostCount === 0) return;
    if (firstTaskHandled.has(userId)) return;
    firstTaskHandled.add(userId);
    try {
        const [done, prompted] = await Promise.all([
            AsyncStorage.getItem(guestTutorialDoneKey(userId)),
            AsyncStorage.getItem(accountPromptFirstTaskKey(userId)),
        ]);
        if (done !== "true" || prompted === "true") {
            // Tutorial not finished yet: let a later task try again.
            if (done !== "true") firstTaskHandled.delete(userId);
            return;
        }
    } catch {
        firstTaskHandled.delete(userId);
        return;
    }
    setTimeout(() => {
        if (hostCount === 0 || !eligible || state.visible) {
            firstTaskHandled.delete(userId);
            return;
        }
        AsyncStorage.setItem(accountPromptFirstTaskKey(userId), "true").catch(() => {});
        openAccountOverlay("first-task");
    }, FIRST_TASK_PROMPT_DELAY_MS);
}

export function useAccountOverlay() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return {
        visible: snapshot.visible,
        request: snapshot.request,
        openAccountOverlay,
        closeAccountOverlay,
        dismissAccountOverlay,
    };
}

/** Test-only: reset module state between tests. */
export function __resetAccountOverlayStore() {
    state = { visible: false, request: null };
    hostCount = 0;
    eligible = false;
    pending = null;
    tourActive = false;
    promptedSurfaces.clear();
    firstTaskHandled.clear();
    listeners.forEach((fn) => fn());
}
