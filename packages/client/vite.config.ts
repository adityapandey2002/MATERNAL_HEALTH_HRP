import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { loadClientConfig } from "./build.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  loadClientConfig(env);

  return {
    plugins: [
      react(),
      VitePWA({
        // The worker is registered by `utils/sw.ts` so the app controls when a
        // waiting build is activated. The manifest is the static
        // `public/manifest.json` linked from index.html.
        registerType: "prompt",
        injectRegister: null,
        manifest: false,
        includeAssets: ["robots.txt"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          // A deep link opened with no connection must boot the shell.
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
          // No runtime caching of API responses: patient data lives in Dexie,
          // never in Cache Storage.
        },
      }),
    ],
    resolve: {
      alias: {
        "@hrp/shared": path.resolve(__dirname, "../shared/src"),
        "@hrp/client": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // In Docker the API is a separate service, so the target has to be
        // configurable. Locally it falls back to the host's port 3000.
        "/api": {
          target: process.env.VITE_PROXY_TARGET ?? "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    build: {
      target: "es2022",
      minify: "esbuild",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            shared: ["@hrp/shared"],
          },
        },
      },
    },
  };
});
