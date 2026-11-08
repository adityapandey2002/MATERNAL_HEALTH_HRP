import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isNativeApp, registerNativeLifecycle } from "./lib/native";
import { getCachedSession } from "./lib/session-cache";
import { registerSW } from "./utils/sw";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Seed the session cache so role-gated UI keeps working while offline.
const cached = getCachedSession();
if (cached) {
  queryClient.setQueryData(["auth", "me"], cached.user);
}

// The APK ships its own shell, so a service worker adds nothing there; the
// native build relies on the bundled assets and its own lifecycle hooks.
if ("serviceWorker" in navigator && !isNativeApp()) {
  registerSW();
}

void registerNativeLifecycle();

// A field device must not lose unsynced records to cache eviction.
if (navigator.storage?.persist) {
  void navigator.storage.persist();
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary label="root">
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
