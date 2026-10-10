/**
 * src/hooks/useReducedMotionPreference.ts
 * WHAT: Reads the user's "reduce motion" system setting.
 * WHY : Framer Motion has its own hook for this, but several plain-CSS pieces
 *       (the skeleton shimmer, the confetti, the escrow tracker fill) need the
 *       same answer without pulling in the animation library.
 */
"use client";

import { useEffect, useState } from "react";

/**
 * useReducedMotionPreference
 * WHAT: Returns true when the user's device asks for less animation.
 * WHY : We check it on mount and listen for changes, because the setting can be
 *       toggled while the app is open.
 */
export function useReducedMotionPreference(): boolean {
  // Default to false; we correct it in the effect so server and client agree
  // on the first render (avoiding a hydration mismatch).
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Older browsers may not support matchMedia.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    // React to the user changing the setting live.
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
