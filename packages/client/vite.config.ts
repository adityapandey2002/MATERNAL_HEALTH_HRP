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
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt"],
        manifest: {
          name: "Matru Suraksha",
          short_name: "Matru Suraksha",
          description: "Matru Suraksha — high-risk pregnancy care in Araria",
          theme_color: "#16a34a",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            { src: "pwa-192.svg", sizes: "192x192", type: "image/svg+xml" },
            { src: "pwa-512.svg", sizes: "512x512", type: "image/svg+xml" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\/api\/.*/,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
                networkTimeoutSeconds: 10,
              },
            },
          ],
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
