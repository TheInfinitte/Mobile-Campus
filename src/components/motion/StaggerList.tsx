/**
 * src/components/motion/StaggerList.tsx
 * WHAT: Animates a list of cards in one by one (staggered fade-in).
 * WHY : A list of lodges appearing all at once looks flat. A 40ms stagger makes
 *       it feel considered - and it stays well under the 400ms total budget
 *       because each item only takes 260ms.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";

type StaggerListProps = {
  children: React.ReactNode[];
  /** Gap between items, in Tailwind spacing units applied as inline style. */
  gap?: number;
  className?: string;
  /** Start the animation only when the list scrolls into view. */
  inView?: boolean;
};

/**
 * StaggerList
 * WHAT: Wraps each child in a motion.div with an increasing delay.
 * WHY : One component handles the stagger maths so individual cards stay simple.
 */
export function StaggerList({ children, gap = 12, className, inView = false }: StaggerListProps) {
  const reducedMotion = useReducedMotion();

  // Reduced motion: a plain div with the same spacing, no animation.
  if (reducedMotion) {
    return (
      <div className={className} style={{ display: "flex", flexDirection: "column", gap }}>
        {children}
      </div>
    );
  }

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap }}>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          // `whileInView` waits until the item is near the viewport, so a long
          // list does not animate items the user has not reached yet.
          {...(inView
            ? { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-40px" } }
            : { animate: { opacity: 1, y: 0 } })}
          // Cap the stagger so item 20 does not wait a whole second to appear.
          transition={{ duration: 0.26, delay: Math.min(index * 0.045, 0.36), ease: "easeOut" }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

/**
 * FadeIn
 * WHAT: A single-element fade-in.
 * WHY : Sometimes you want one card or banner to animate in without a list.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
