import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { isNetworkError } from "@/api/client";

// Anything older than this on disk is dropped instead of shown on launch
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24;

// Shared by the app and the background refresh task, so both read and write one cache
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            refetchOnReconnect: true,
            // Retry only when we couldn't reach the server. A genuine 4xx
            // should surface immediately rather than being tried again.
            retry: (failureCount, error) => isNetworkError(error) && failureCount < 1,
            retryDelay: 1000,
            staleTime: 1000 * 60 * 2, // 2 minutes - data considered fresh
            // Kept as long as the disk copy so a cold launch has something to show
            gcTime: PERSIST_MAX_AGE,
        },
    },
});

export const queryPersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: "react_query_cache_v1",
    throttleTime: 1000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
    persister: queryPersister,
    maxAge: PERSIST_MAX_AGE,
    // A new app version may change response shapes; start clean instead of misreading them
    buster: Constants.expoConfig?.version ?? "dev",
    dehydrateOptions: {
        // Opt a query out with `meta: { persist: false }`
        shouldDehydrateQuery: (query) => query.state.status === "success" && query.meta?.persist !== false,
    },
};
