import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Start adds SSR declarations to its route tree. Separate the SPA output so
  // concurrent Start/SPA servers cannot keep overwriting each other's file.
  plugins: [
    tanstackRouter({ target: "react", generatedRouteTree: "./src/routeTree.spa.gen.ts" }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@/routeTree.gen": fileURLToPath(new URL("./src/routeTree.spa.gen.ts", import.meta.url)),
    },
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  build: {
    outDir: ".output/public",
    emptyOutDir: true,
  },
});
