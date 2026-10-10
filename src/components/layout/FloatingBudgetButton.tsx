/**
 * src/components/layout/FloatingBudgetButton.tsx
 * WHAT: The floating "Ask the AI" button that appears on the Housing and Market
 *       pages and opens the Budget Assistant.
 * WHY : The spec asks for the assistant to be reachable from the pages where a
 *       student is actually deciding what to spend. A floating button is one tap
 *       away without taking up list space.
 *
 * It hides itself while the user scrolls down and reappears when they scroll up,
 * so it never blocks a card they are trying to read.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SparkleIcon } from "@/components/ui/Icons";

/**
 * FloatingBudgetButton
 * WHAT: A gold floating action button linking to /budget.
 * WHY : Placed above the bottom navigation on phones and bottom-right on
 *       desktop, where thumbs and cursors naturally look.
 */
export function FloatingBudgetButton() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      // Show when scrolling up, hide when scrolling down (but always show near
      // the top of the page so it is never permanently hidden).
      if (currentY < 120) setVisible(true);
      else setVisible(currentY < lastY);
      lastY = currentY;
    };

    // `passive: true` tells the browser we will not call preventDefault, so it
    // can keep scrolling smoothly.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 8 }}
          transition={{ duration: 0.22 }}
          // Sits above the mobile bottom nav (72px) plus a little breathing room.
          className="fixed bottom-[calc(var(--mc-nav-height)+1rem)] right-4 z-40 md:bottom-8 md:right-8"
        >
          <Link
            href="/budget"
            aria-label="Open the AI Budget Assistant"
            className="flex h-14 items-center gap-2 rounded-full bg-primary-600 pl-4 pr-5 text-sm font-bold text-white shadow-float transition active:scale-95"
          >
            <SparkleIcon size={22} />
            <span className="hidden sm:inline">Ask Budget AI</span>
            <span className="sm:hidden">AI</span>
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
