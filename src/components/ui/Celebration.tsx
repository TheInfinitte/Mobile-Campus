/**
 * src/components/ui/Celebration.tsx
 * WHAT: The success celebration - a Lottie animation plus a lightweight CSS
 *       confetti burst - shown after a payment succeeds or an admin approves a
 *       verification.
 * WHY : Money movement is stressful. A clear, joyful confirmation tells the
 *       user "this worked, your money is safe" far better than a text message.
 *
 * PERFORMANCE & ACCESSIBILITY:
 *   - The Lottie JSON is about 1KB and is only fetched when this renders.
 *   - If the user prefers reduced motion we skip the animation entirely and
 *     show a static check mark instead.
 *   - The overlay disappears automatically so the user is never trapped.
 */
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Lottie from "lottie-react";
// The Lottie JSON is imported at build time and bundled - no network request
// and no chance of a missing file at runtime.
import successAnimation from "../../../public/lottie/success.json";
import confettiAnimation from "../../../public/lottie/confetti.json";
import { cn } from "@/lib/utils";
import { CheckIcon } from "./Icons";

/** Pre-computed confetti piece positions so the burst looks natural. */
const CONFETTI_PIECES = Array.from({ length: 18 }).map((_, index) => ({
  // Spread the pieces evenly around the circle with a little jitter.
  angle: (index / 18) * Math.PI * 2,
  distance: 70 + ((index * 37) % 60),
  delay: (index % 6) * 0.03,
  size: 6 + ((index * 5) % 5),
  // Rotate through the brand colours.
  color: ["#4f46e5", "#f59e0b", "#0d9488", "#6366f1", "#fbbf24"][index % 5],
}));

type CelebrationProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  /** "check" for approvals, "confetti" for payments. */
  variant?: "check" | "confetti";
  /** Optional action button, e.g. "View my payment". */
  action?: { label: string; onClick: () => void };
};

/**
 * Celebration
 * WHAT: A full-screen overlay with a Lottie animation, a headline, an optional
 *       message and an optional button.
 * WHY : Used by the escrow success screen, the verification approval screen and
 *       the admin approval action.
 */
export function Celebration({ open, onClose, title, message, variant = "check", action }: CelebrationProps) {
  // Respect the user's motion preference.
  const reducedMotion = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);

  // Auto-close after a few seconds if the user does nothing, and start the
  // confetti a beat after the overlay appears so the two do not fight.
  useEffect(() => {
    if (!open) return;
    setShowConfetti(false);

    const confettiTimer = window.setTimeout(() => setShowConfetti(true), 350);
    const closeTimer = window.setTimeout(onClose, action ? 12000 : 3500);

    return () => {
      window.clearTimeout(confettiTimer);
      window.clearTimeout(closeTimer);
    };
  }, [open, onClose, action]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Card */}
          <motion.div
            role="status" // Announced as a live status message by screen readers.
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl"
          >
            {/* CSS confetti burst - only when motion is allowed. */}
            {showConfetti && !reducedMotion && variant === "confetti" ? (
              <div className="pointer-events-none absolute left-1/2 top-24 h-0 w-0" aria-hidden="true">
                {CONFETTI_PIECES.map((piece, index) => (
                  <motion.span
                    key={index}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos(piece.angle) * piece.distance,
                      y: Math.sin(piece.angle) * piece.distance + 40,
                      opacity: 0,
                      scale: 0.4,
                      rotate: 220,
                    }}
                    transition={{ duration: 0.9, delay: piece.delay, ease: "easeOut" }}
                    className="absolute block rounded-[2px]"
                    style={{
                      width: piece.size,
                      height: piece.size * 1.6,
                      backgroundColor: piece.color,
                    }}
                  />
                ))}
              </div>
            ) : null}

            {/* The animation itself, or a static check for reduced motion. */}
            <div className="mx-auto mb-4 h-32 w-32">
              {reducedMotion ? (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <CheckIcon size={64} />
                </div>
              ) : (
                <Lottie
                  animationData={variant === "confetti" ? confettiAnimation : successAnimation}
                  loop={false}
                  // Play once so it does not become distracting.
                  autoplay
                  style={{ height: "100%", width: "100%" }}
                />
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {message ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{message}</p> : null}

            <div className="mt-5 flex flex-col gap-2">
              {action ? (
                <button type="button" onClick={action.onClick} className="mc-btn-primary w-full">
                  {action.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className={cn("w-full text-sm font-semibold text-slate-500", "min-h-[44px]")}
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
