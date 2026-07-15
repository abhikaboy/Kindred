import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
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
