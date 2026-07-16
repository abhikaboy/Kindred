import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { ThemeProvider } from "@/lib/theme";
import { getErrorMessage, isAuthError } from "@/lib/errors";
import App from "./App";
import "./index.css";

// Central API-error toast. 401s are skipped — the client's auth layer logs out.
function notifyError(error: unknown, fallback?: string) {
  if (isAuthError(error)) return;
  toast.error(getErrorMessage(error, fallback));
}

const queryClient = new QueryClient({
  // Writes always toast; reads toast only on first-load failure (no stale data to show).
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      notifyError(error, mutation.meta?.errorMessage as string | undefined),
  }),
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data === undefined) notifyError(error);
    },
  }),
  defaultOptions: {
    queries: {
      // Desktop windows lose/regain focus constantly (alt-tab) — don't refetch on it.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: false,
      staleTime: 1000 * 60, // 1 min — data stays fresh across route navigation
      gcTime: 1000 * 60 * 5,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
