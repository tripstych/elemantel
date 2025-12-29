import { defineConfig } from "vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 8080,
    open: true,
    fs: {
      // Allow serving assets from the repo-level assets directory
      allow: [
        // Fondue project root (for any /@fs requests to local files)
        path.resolve(__dirname),
        // Repo-level assets for tiles
        path.resolve(__dirname, "../assets"),
        // Shared data folder (JSON, dictionaries)
        path.resolve(__dirname, "../data"),
        // Shared code folder (TS constants)
        path.resolve(__dirname, "../shared"),
      ],
      strict: false,
    },
  },
  resolve: {
    alias: {
      // Convenience alias if needed for imports
      "/assets": path.resolve(__dirname, "../assets"),
      "@shared": path.resolve(__dirname, "../shared"),
      "@data": path.resolve(__dirname, "../data"),
    },
  },
});
