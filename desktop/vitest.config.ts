import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
      // ../shared sits outside this root, so its bare imports must be pointed here.
      "chrono-node": path.resolve(__dirname, "node_modules/chrono-node"),
    },
  },
  server: { fs: { allow: [path.resolve(__dirname, "..")] } },
  test: {
    environment: "jsdom",
    // shared/ has no runner of its own; desktop's vitest owns those tests.
    include: ["src/**/*.test.{ts,tsx}", "../shared/**/*.test.ts"],
  },
});
