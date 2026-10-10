/**
 * src/components/motion/PageTransition.tsx
 * WHAT: A short fade-and-slide wrapper applied to every page as it appears.
 * WHY : The design spec asks for 200-300ms page transitions. Wrapping a page in
 *       this component gives every screen the same calm entrance without
 *       repeating animation code in each route.
 *
 * It also respects prefers-reduced-motion: when the user asks for less motion
 * we render the children with no animation at all.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * PageTransition
 * WHAT: Fades the page in and slides it up slightly.
 * WHY : A 6px slide is enough to feel like movement without making users dizzy
 *       or making them wait for the content.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();

  // Reduced motion: render the children exactly as they are.
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      // 240ms sits in the middle of the required 200-300ms range.
      transition={{ duration: 0.24, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
