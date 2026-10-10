/**
 * src/components/ui/Modal.tsx
 * WHAT: A bottom-sheet style modal (slides up from the bottom on phones,
 *       centres on larger screens) with a dimmed backdrop.
 * WHY : Bottom sheets are the natural pattern on mobile - they are reachable
 *       with one thumb and do not cover the whole screen. We use them for
 *       filters, fee breakdowns, report forms and confirmations.
 *
 * ACCESSIBILITY:
 *   - Closes on Escape.
 *   - Closes when the backdrop is tapped.
 *   - Focus is moved into the sheet when it opens.
 *   - The backdrop and sheet have the right ARIA roles.
 */
"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CloseIcon } from "./Icons";
import { IconButton } from "./Button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional footer, usually one or two buttons. */
  footer?: React.ReactNode;
  /** Extra classes for the sheet itself. */
  className?: string;
};

/**
 * Modal
 * WHAT: Renders the sheet and backdrop, animated in and out.
 * WHY : One modal implementation means every overlay in the app behaves the
 *       same way and is equally accessible.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  // A ref to the sheet so we can move focus into it when it opens.
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on the Escape key.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Stop the page behind the modal from scrolling while it is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the sheet for keyboard and screen-reader users.
    sheetRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop: tap anywhere to close. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }} // 200ms, inside the 400ms budget.
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* The sheet itself. */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            // tabIndex makes it focusable so focus can land here.
            tabIndex={-1}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }} // 280ms slide-up.
            className={cn(
              "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl",
              // On tablets and desktops, centre it and cap the width.
              "sm:max-w-lg sm:rounded-3xl",
              className
            )}
          >
            {/* A little grab handle, like native mobile sheets. */}
            <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <div className="h-1.5 w-10 rounded-full bg-slate-200" />
            </div>

            {/* Header with the title and a close button. */}
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <IconButton label="Close" icon={<CloseIcon size={20} />} onClick={onClose} className="-mr-2 -mt-1" />
            </div>

            {/* Scrollable body - long forms must scroll, not overflow. */}
            <div className="flex-1 overflow-y-auto px-5 pb-2">{children}</div>

            {/* Sticky footer so the action buttons are always reachable. */}
            {footer ? (
              <div className="border-t border-slate-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * ConfirmDialog
 * WHAT: A yes/no dialog built on top of Modal.
 * WHY : Destructive or money-related actions (releasing escrow, reporting a
 *       scam, cancelling a viewing) must always ask "are you sure?" first.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="mc-btn-secondary flex-1">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn("flex-1", danger ? "mc-btn-danger" : "mc-btn-primary")}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="pb-4 text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  );
}
