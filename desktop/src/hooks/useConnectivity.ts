import { useEffect, useSyncExternalStore } from "react";
import {
  getNetStatus,
  isOffline as computeIsOffline,
  reportRadioState,
  subscribeNetStatus,
  type NetStatus,
} from "@/lib/netStatus";

export interface Connectivity extends NetStatus {
  /**
   * Our best guess at "can we talk to Kindred right now?". Combines
   * `navigator.onLine` with what our own requests have observed, so a captive
   * portal or a down backend reads as offline even though the OS says we have
   * an interface.
   */
  isOffline: boolean;
}

/**
 * Subscribe to connectivity.
 *
 * Mounting this anywhere also wires the browser's online/offline events into
 * the shared store, which the API client reads without needing React.
 */
export function useConnectivity(): Connectivity {
  const status = useSyncExternalStore(subscribeNetStatus, getNetStatus, getNetStatus);

  useEffect(() => {
    const sync = () => reportRadioState(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return { ...status, isOffline: computeIsOffline(status) };
}
