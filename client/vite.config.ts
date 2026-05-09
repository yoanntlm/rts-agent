import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { imgApiPlugin } from "./vite-plugins/img-api";

export default defineConfig({
  plugins: [react(), tailwindcss(), imgApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "../convex"),
      "@characters": path.resolve(__dirname, "../characters"),
      convex: path.resolve(__dirname, "./node_modules/convex"),
    },
  },
  server: {
    port: 5173,
    fs: {
      // Allow imports from the monorepo root (characters/, convex/).
      allow: [path.resolve(__dirname, "..")],
    },
    // Forward the runner's read-only file API to the prod VPS during local dev.
    // In prod (Caddy), this same path is reverse-proxied to localhost:4000.
    proxy: {
      "/api/code": {
        target: "https://citybuilder.yoanntlm.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
