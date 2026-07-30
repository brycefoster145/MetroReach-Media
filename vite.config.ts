import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    // The site is reverse-proxied behind <label>.<PUBLIC_SITE_DOMAIN>; the proxy
    // masks the Host to localhost:3000, but accept any host so a dev server never
    // rejects a proxied request with "Blocked request".
    allowedHosts: true,
  },
  ssr: {
    // Externalize heavy Node.js dependencies to prevent OOM during SSR build.
    // These are re-bundled by `bun build` in the Vercel deployment pipeline.
    // Without this, Vite tries to bundle stripe (2MB+), openai (3MB+), postgres,
    // and neon into the SSR chunks, consuming ~400MB+ of heap and crashing.
    external: [
      "stripe",
      "openai",
      "postgres",
      "@neondatabase/serverless",
      "@sendgrid/mail",
      "@phosphor-icons/react",
      "sharp",
    ],
    noExternal: [
      // TanStack Router MUST be bundled — the server.js references internal
      // router APIs that are not available via package exports.
      "@tanstack/react-router",
      "@tanstack/react-start",
      "@tanstack/router-core",
      "@tanstack/history",
    ],
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress unused-external-import warnings from TanStack internals
        if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
        warn(warning);
      },
    },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
  ],
});
