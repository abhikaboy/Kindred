import { useEffect, useSyncExternalStore } from "react";
import * as Network from "expo-network";
import {
    getNetStatus,
    isOffline as computeIsOffline,
    reportRadioState,
    subscribeNetStatus,
    type NetStatus,
} from "@/utils/netStatus";

export interface Connectivity extends NetStatus {
    /**
     * Our best guess at "can we talk to Kindred right now?". Combines the OS
     * radio state with what our own requests have observed, so a captive portal
     * or a down backend reads as offline even though the radio is up.
     */
    isOffline: boolean;
}

/**
 * Subscribe to connectivity.
 *
 * Mounting this anywhere also wires expo-network's radio state into the shared
 * store, which the API client reads without needing React.
 */
export function useConnectivity(): Connectivity {
    const status = useSyncExternalStore(subscribeNetStatus, getNetStatus, getNetStatus);
    const networkState = Network.useNetworkState();

    useEffect(() => {
        if (networkState.isConnected === undefined || networkState.isConnected === null) return;
        // `isInternetReachable` is undefined while expo-network is still
        // probing; treat that as "connected" rather than flashing an offline
        // banner during startup.
        const reachable = networkState.isInternetReachable ?? true;
        reportRadioState(Boolean(networkState.isConnected) && reachable);
    }, [networkState.isConnected, networkState.isInternetReachable]);

    return { ...status, isOffline: computeIsOffline(status) };
}
