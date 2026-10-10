/**
 * src/components/layout/Providers.tsx
 * WHAT: Client-side providers that must wrap the whole app: the toast system
 *       and the PWA service-worker registration.
 * WHY : React context has to be created on the client, but our app is a server
 *       component tree (needed for reading the session cookie). This thin client
 *       wrapper bridges the two.
 */
"use client";

import { useEffect } from "react";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Providers
 * WHAT: Wraps the app in the toast provider and registers the service worker.
 * WHY : One place to add any future global provider (theme, analytics) without
 *       touching the root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Register the service worker once, after the page has painted.
  // We only do this in production: during development the worker would serve
  // stale pages and make debugging confusing.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // waitUntilLoaded avoids competing with the initial page download.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Failing to register must never break the app - it only means no
        // offline support, so we just log it.
        console.warn("Service worker registration failed:", error);
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}
