/**
 * Connectivity store.
 *
 * Two independent signals feed this store:
 *
 *   1. The OS radio state, pushed in by `useConnectivity` via expo-network.
 *   2. The outcome of real requests, pushed in by the API client.
 *
 * Both are needed. expo-network tells us the wifi/cellular radio is up, but it
 * cannot tell us the backend is unreachable — a captive portal, a dead backend,
 * or a DNS failure all look "online" to the OS. Conversely, request outcomes
 * only update when we happen to make a request. Taken together they give a
 * reasonable answer to "can we talk to Kindred right now?".
 *
 * This module is deliberately React-free so the API client can use it without
 * pulling in hooks. `useConnectivity` is the React view over it.
 */

export type Reachability = "unknown" | "reachable" | "unreachable";

type Listener = (state: NetStatus) => void;

export interface NetStatus {
    /** OS-level radio state. `null` until expo-network reports in. */
    radioOnline: boolean | null;
    /** What our own requests have most recently observed. */
    reachability: Reachability;
    /** When we last successfully talked to the backend. */
    lastReachableAt: number | null;
}

let state: NetStatus = {
    radioOnline: null,
    reachability: "unknown",
    lastReachableAt: null,
};

const listeners = new Set<Listener>();

function emit() {
    for (const listener of listeners) listener(state);
}

export function subscribeNetStatus(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getNetStatus(): NetStatus {
    return state;
}

/** Called by the API client whenever a request completes successfully. */
export function reportReachable() {
    if (state.reachability === "reachable") {
        // Still refresh the timestamp, but skip the re-render.
        state = { ...state, lastReachableAt: Date.now() };
        return;
    }
    state = { ...state, reachability: "reachable", lastReachableAt: Date.now() };
    emit();
}

/** Called by the API client when a request fails for a network/timeout reason. */
export function reportUnreachable() {
    if (state.reachability === "unreachable") return;
    state = { ...state, reachability: "unreachable" };
    emit();
}

/** Called by `useConnectivity` with the expo-network radio state. */
export function reportRadioState(online: boolean) {
    if (state.radioOnline === online) return;
    // Regaining the radio makes our last request-derived verdict stale: we have
    // no idea whether the backend is reachable on this new network until we try.
    state = {
        ...state,
        radioOnline: online,
        reachability: online ? "unknown" : "unreachable",
    };
    emit();
}

/**
 * The single question the rest of the app asks.
 *
 * We only claim to be offline when we have positive evidence — either the radio
 * is down or a request actually failed. "unknown" counts as online so a cold
 * start doesn't flash an offline banner before the first request resolves.
 */
export function isOffline(status: NetStatus = state): boolean {
    if (status.radioOnline === false) return true;
    return status.reachability === "unreachable";
}
