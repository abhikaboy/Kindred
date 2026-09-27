import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { guestTaskCountKey, guestTutorialDoneKey } from "@/constants/authStorageKeys";
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

export type AccountOverlayReason = "task-limit" | "social" | "login-link" | "skipped-tutorial";
export type SocialSurface = "feed" | "search" | "friends" | "profile";
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
export const TASK_PROMPT_DELAY_MS = 1500;
// From this many self-made tasks on, every new one asks for an account.
export const GUEST_TASK_LIMIT = 3;

let state: State = { visible: false, request: null };
const listeners = new Set<() => void>();

let hostCount = 0;
// A guest who has finished the tutorial. Kept in sync by the mounted host.
let eligible = false;
// A request made while the home tour is running waits for the tour to end.
let pending: AccountOverlayRequest | null = null;
let tourActive = false;
// The signed-in guest, so eligibility can be re-read from storage when stale.
let guestId: string | null = null;
// Set by skipping the tutorial: open as soon as the host confirms eligibility.
let openWhenEligible = false;
// Social surfaces already prompted this app session.
const promptedSurfaces = new Set<SocialSurface>();
// Serializes the persisted task count so tasks created together all count.
let taskCountChain: Promise<unknown> = Promise.resolve();

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
    else if (openWhenEligible) {
        openWhenEligible = false;
        openAccountOverlay("skipped-tutorial");
    }
}

/** Set by the host so the store can re-check the tutorial flag itself. */
export function setAccountOverlayGuest(id: string | null) {
    guestId = id;
}

/**
 * The host reads the tutorial flag once on mount, which misses a tutorial
 * finished while it was already mounted. Re-read before giving up.
 */
async function refreshEligible(): Promise<boolean> {
    if (eligible) return true;
    const id = guestId;
    if (!id) return false;
    try {
        if ((await AsyncStorage.getItem(guestTutorialDoneKey(id))) !== "true") return false;
    } catch {
        return false;
    }
    if (guestId !== id) return false;
    setAccountOverlayEligible(true);
    return true;
}

/** The guest finished the tutorial; triggers can fire from now on. */
export function markGuestTutorialDone() {
    setAccountOverlayEligible(true);
}

/** The guest skipped the tutorial: prompt as soon as they land in the app. */
export function promptAccountAfterSkippingTutorial() {
    eligible = true;
    if (hostCount > 0) openAccountOverlay("skipped-tutorial");
    else openWhenEligible = true;
}

/**
 * Social surfaces need an account, so a guest reaching one gets the overlay.
 * Once per session unless `everyVisit`. Returns true when it showed.
 */
export function promptAccountForSocial(
    surface: SocialSurface,
    onDismiss?: () => void,
    { everyVisit = false }: { everyVisit?: boolean } = {}
): boolean {
    if (!eligible) {
        void refreshEligible().then((ok) => ok && promptAccountForSocial(surface, onDismiss, { everyVisit }));
        return false;
    }
    if (hostCount === 0 || state.visible || tourActive) return false;
    if (!everyVisit && promptedSurfaces.has(surface)) return false;
    promptedSurfaces.add(surface);
    openAccountOverlay("social", { surface, onDismiss });
    return true;
}

/**
 * After each task a guest creates. From their GUEST_TASK_LIMIT-th on, ask for an
 * account. The tutorial's own task never counts: its done flag isn't set yet.
 */
export function promptAccountAfterTask(user?: { _id?: string; isGuest?: boolean } | null): Promise<void> {
    const userId = user?._id;
    if (!userId || !user?.isGuest || hostCount === 0) return Promise.resolve();
    const run = taskCountChain.then(async () => {
        let count: number;
        try {
            if ((await AsyncStorage.getItem(guestTutorialDoneKey(userId))) !== "true") return;
            count = (Number(await AsyncStorage.getItem(guestTaskCountKey(userId))) || 0) + 1;
            await AsyncStorage.setItem(guestTaskCountKey(userId), String(count));
        } catch {
            return;
        }
        if (count < GUEST_TASK_LIMIT) return;
        // The flag was just read as done, so the host's view may be stale
        if (!eligible) setAccountOverlayEligible(true);
        setTimeout(() => {
            if (hostCount === 0 || !eligible) return;
            openAccountOverlay("task-limit");
        }, TASK_PROMPT_DELAY_MS);
    });
    taskCountChain = run.catch(() => {});
    return run;
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
    openWhenEligible = false;
    guestId = null;
    promptedSurfaces.clear();
    taskCountChain = Promise.resolve();
    listeners.forEach((fn) => fn());
}
