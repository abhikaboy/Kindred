import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
      // ../shared sits outside this root, so its bare imports must be pointed here.
      "chrono-node": path.resolve(__dirname, "node_modules/chrono-node"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the large Phosphor icon set out of the main bundle.
        manualChunks(id: string) {
          if (id.includes("@phosphor-icons")) return "phosphor";
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available.
  // 3000 (not Tauri's default 1420) because that origin is in the backend's CORS
  // allowlist, which lets dev call the prod API directly. Keep tauri.conf.json's
  // devUrl in sync.
  server: {
    port: 3000,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // Dev server must be allowed to serve ../shared, which sits outside the root.
    fs: { allow: [path.resolve(__dirname, "..")] },
    // Fallback proxy for any relative "/api" request. The API client now uses an
    // absolute origin (see src/lib/api/client.ts), so this is normally unused.
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "https://kindredtodo.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
}));
