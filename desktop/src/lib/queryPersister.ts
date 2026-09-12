import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Persists the react-query cache to localStorage so the app cold-starts offline
 * with the last synced workspace instead of an empty shell.
 *
 * Lives in its own module rather than next to the QueryClient in `main.tsx`:
 * the auth layer needs to drop the persisted cache on logout, and importing
 * from `main` would close an import cycle.
 */
export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "kindred-query-cache",
});
