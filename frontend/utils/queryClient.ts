import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { isNetworkError } from "@/api/client";

// Anything older than this on disk is dropped instead of shown on launch
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24;
// Everything else is freed from memory this long after its last observer goes away
const IN_MEMORY_GC = 1000 * 60 * 10;

// The only queries written to disk (and parsed on the JS thread at launch): what the first
// screens need. Feeds, search, memories, analytics and the like refetch when opened.
// The background refresh task warms "rings" and "forYou" for launch, so those must stay.
const PERSISTED_KEYS: ReadonlySet<string> = new Set([
    "rings",
    "forYou",
    "profile",
    "friends",
    "home-friends",
    "templates",
    "taskTags",
    "groups",
]);
// A persisted blob past this size costs more to parse at launch than it saves, so start clean
const MAX_PERSISTED_BYTES = 1_000_000;

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
            gcTime: IN_MEMORY_GC,
        },
    },
});

// Persisted queries must outlive a restore, so they keep the long lifetime
PERSISTED_KEYS.forEach((key) => queryClient.setQueryDefaults([key], { gcTime: PERSIST_MAX_AGE }));

export const queryPersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: "react_query_cache_v1",
    // Each write re-serializes the whole cache on the JS thread
    throttleTime: 5000,
    serialize: (client) => {
        const json = JSON.stringify(client);
        return json.length > MAX_PERSISTED_BYTES ? JSON.stringify({ ...client, clientState: { ...client.clientState, queries: [] } }) : json;
    },
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
    persister: queryPersister,
    maxAge: PERSIST_MAX_AGE,
    // A new app version may change response shapes; start clean instead of misreading them
    buster: Constants.expoConfig?.version ?? "dev",
    dehydrateOptions: {
        // Opt a query out with `meta: { persist: false }`
        shouldDehydrateQuery: (query) =>
            query.state.status === "success" && query.meta?.persist !== false && PERSISTED_KEYS.has(String(query.queryKey[0])),
    },
};
