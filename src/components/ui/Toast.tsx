/**
 * src/components/ui/Toast.tsx
 * WHAT: A tiny toast system: `toast.success("Saved")` shows a message at the
 *       bottom of the screen for three seconds.
 * WHY : After a form submit or a shortlist tap the user needs instant feedback.
 *       A toast is lighter than navigating to a new page and works on any
 *       screen without extra layout.
 */
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertIcon, CheckIcon, InfoIcon } from "./Icons";

/** The kinds of toast, which decide the colour and the icon. */
type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

/** The API the rest of the app uses. */
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

// A context so any component can call `useToast()` without prop drilling.
const ToastContext = createContext<ToastApi | null>(null);

/** How long a toast stays on screen. */
const TOAST_DURATION_MS = 3200;

/**
 * ToastProvider
 * WHAT: Holds the list of active toasts and renders them.
 * WHY : Must wrap the app once (in Providers) so every screen can trigger one.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /** Adds a toast and schedules its removal. */
  const push = useCallback((message: string, tone: ToastTone) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]); // Keep at most 3 visible.

    // Remove it after the duration. Using setTimeout is fine here because the
    // toast is purely visual.
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  // useMemo keeps the API object stable so consumers do not re-render needlessly.
  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* The toast stack. Fixed above the bottom navigation (z-40 < nav's z-50
          is intentional on desktop; on mobile we push it above the nav). */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--mc-nav-height)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite" // Screen readers announce new toasts politely.
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22 }} // 220ms - inside the motion budget.
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg",
                toast.tone === "success" && "bg-success text-white",
                toast.tone === "error" && "bg-danger text-white",
                toast.tone === "info" && "bg-slate-900 text-white"
              )}
            >
              <span className="mt-0.5 shrink-0">
                {toast.tone === "success" ? (
                  <CheckIcon size={18} />
                ) : toast.tone === "error" ? (
                  <AlertIcon size={18} />
                ) : (
                  <InfoIcon size={18} />
                )}
              </span>
              <span className="leading-snug">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * useToast
 * WHAT: Gives a component the toast API.
 * WHY : `const toast = useToast(); toast.success("Saved!")` is much cleaner than
 *       passing callbacks down through five components.
 */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    // If the provider is missing we return no-op functions instead of crashing,
    // so a forgotten wrapper never breaks the app.
    return { success: () => {}, error: () => {}, info: () => {} };
  }
  return context;
}
