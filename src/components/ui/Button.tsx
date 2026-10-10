/**
 * src/components/ui/Button.tsx
 * WHAT: The one button component used across the whole app, with variants,
 *       sizes, a loading spinner and a press-down animation.
 * WHY : Consistency and accessibility. Every button is at least 44px tall (the
 *       minimum comfortable touch target), shows a spinner while working, and
 *       cannot be double-tapped into sending a payment twice.
 */
"use client"; // Uses click handlers and animation, so it must run in the browser.

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/** The visual styles available. */
type Variant = "primary" | "secondary" | "danger" | "ghost" | "gold";

/** Three sizes. `md` is the default and is exactly 44px tall. */
type Size = "sm" | "md" | "lg";

/**
 * ButtonProps
 * WHAT: Framer Motion's button props plus our own extras.
 * WHY : Extending HTMLMotionProps means `onClick`, `type` and every other native
 *       attribute works, while `whileTap` gives us the press animation.
 */
type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  /** Plain React children - we override the motion type so JSX text just works. */
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Fills the width of its container (used for full-width mobile actions). */
  fullWidth?: boolean;
  /** Optional icon shown before the label. */
  icon?: React.ReactNode;
};

/** Colour classes for each variant, mapped so Tailwind can see them. */
const variantClasses: Record<Variant, string> = {
  primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-float",
  secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
  danger: "bg-danger text-white hover:bg-danger-dark",
  // Ghost buttons are for secondary actions inside cards.
  ghost: "bg-transparent text-primary-700 hover:bg-primary-50",
  gold: "bg-gold-500 text-white hover:bg-gold-600",
};

/** Height/padding classes for each size. */
const sizeClasses: Record<Size, string> = {
  // 40px is allowed for tiny inline actions, but never for primary actions.
  sm: "h-10 px-3.5 text-xs",
  md: "h-11 px-5 text-sm", // 44px - the accessibility minimum.
  lg: "h-13 px-6 text-base",
};

/**
 * Button
 * WHAT: An accessible, animated button.
 * WHY : Wrapping <button> means every screen gets the same disabled state,
 *       focus ring, loading behaviour and press feedback for free.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, fullWidth = false, icon, className, children, disabled, type = "button", ...rest },
  ref
) {
  // A button is disabled if the caller says so OR if it is loading.
  const isDisabled = Boolean(disabled) || loading;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      // whileTap gives the satisfying "press down" feedback. 0.97 is subtle
      // enough to feel premium without looking broken.
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }} // Under 400ms, as the design rules require.
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {/* The spinner replaces the icon while loading so the width stays stable. */}
      {loading ? <Spinner /> : icon}
      {children}
    </motion.button>
  );
});

/**
 * Spinner
 * WHAT: A small circular loading indicator.
 * WHY : Users must always know their tap registered - especially on a slow
 *       connection where a payment can take several seconds.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * IconButton
 * WHAT: A square, icon-only button (back arrows, close, shortlist heart).
 * WHY : Icon buttons still need the 44px touch target and an accessible label,
 *       even though no text is visible.
 */
export function IconButton({
  label,
  icon,
  className,
  ...rest
}: HTMLMotionProps<"button"> & { label: string; icon: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      // The label is read aloud by screen readers.
      aria-label={label}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100",
        className
      )}
      {...rest}
    >
      {icon}
    </motion.button>
  );
}
