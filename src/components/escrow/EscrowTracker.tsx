/**
 * src/components/escrow/EscrowTracker.tsx
 * WHAT: The animated escrow progress tracker: Payment -> Held -> Confirmed ->
 *       Released, with a dispute branch.
 * WHY : This is the trust engine of the product. A student who can SEE that
 *       their money is held and exactly what happens next is far more likely to
 *       pay through escrow than to hand cash to a stranger.
 */
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { escrowSteps, stateLabel } from "@/lib/escrow-state";
import { CheckIcon, AlertIcon, LockIcon } from "@/components/ui/Icons";
import type { EscrowState } from "@prisma/client";

type EscrowTrackerProps = {
  state: EscrowState;
  /** Optional timestamps so each step can show when it happened. */
  dates?: {
    createdAt?: string | Date;
    confirmedAt?: string | Date | null;
    releasedAt?: string | Date | null;
    refundedAt?: string | Date | null;
  };
};

/** Formats a date for the small caption under each step. */
function stepDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/**
 * EscrowTracker
 * WHAT: Draws four steps joined by a line that fills as the deal progresses.
 * WHY : A single animated line makes progress instantly obvious, even for a user
 *       who has never used an escrow service before.
 */
export function EscrowTracker({ state, dates }: EscrowTrackerProps) {
  const reducedMotion = useReducedMotion();

  // Where we are in the four-step track (0-3).
  const currentIndex = escrowSteps.findIndex((step) => step.key === state);
  // For DISPUTED/REFUNDED we still want the bar filled up to "Held".
  const filledTo = currentIndex === -1 ? 1 : currentIndex;

  const isDisputed = state === "DISPUTED";
  const isRefunded = state === "REFUNDED";

  // The caption for each step, using real dates when we have them.
  const captions = [
    dates?.createdAt ? stepDate(dates.createdAt) : "",
    dates?.createdAt ? stepDate(dates.createdAt) : "",
    dates?.confirmedAt ? stepDate(dates.confirmedAt) : "",
    dates?.releasedAt ? stepDate(dates.releasedAt) : dates?.refundedAt ? stepDate(dates.refundedAt) : "",
  ];

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      {/* Current status headline */}
      <div className="mb-5 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            isDisputed ? "bg-danger-light text-danger" : isRefunded ? "bg-slate-100 text-slate-600" : "bg-primary-50 text-primary-700"
          )}
        >
          {isDisputed ? <AlertIcon size={18} /> : <LockIcon size={18} />}
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900">{stateLabel(state)}</p>
          <p className="text-[11px] text-slate-500">
            {isDisputed
              ? "Our team is reviewing this payment."
              : isRefunded
                ? "The money has been returned to the payer."
                : "Money is only released after you confirm."}
          </p>
        </div>
      </div>

      {/* The four steps */}
      <ol className="relative flex items-start justify-between">
        {/* Background track */}
        <div className="absolute left-4 right-4 top-4 h-[3px] rounded-full bg-slate-200" aria-hidden="true" />

        {/* Filled portion - animates its width as the deal progresses. */}
        <motion.div
          className="absolute left-4 top-4 h-[3px] rounded-full bg-primary-600"
          initial={false}
          animate={{ width: `calc((100% - 2rem) * ${filledTo / (escrowSteps.length - 1)})` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
          aria-hidden="true"
        />

        {escrowSteps.map((step, index) => {
          const done = index < filledTo;
          const current = index === filledTo;

          return (
            <li key={step.key} className="relative z-10 flex w-1/4 flex-col items-center text-center">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
                  done && "border-primary-600 bg-primary-600 text-white",
                  current && "border-primary-600 bg-white text-primary-700",
                  !done && !current && "border-slate-200 bg-white text-slate-400"
                )}
              >
                {done ? <CheckIcon size={16} /> : index + 1}
              </span>

              <span className={cn("mt-2 text-[11px] font-semibold leading-tight", current ? "text-primary-700" : done ? "text-slate-700" : "text-slate-400")}>
                {step.label}
              </span>
              <span className="mt-0.5 hidden text-[10px] text-slate-400 sm:block">{step.hint}</span>
              {captions[index] ? <span className="mt-0.5 text-[10px] text-slate-400">{captions[index]}</span> : null}
            </li>
          );
        })}
      </ol>

      {/* Dispute / refund banner */}
      {isDisputed || isRefunded ? (
        <div
          className={cn(
            "mt-5 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed",
            isDisputed ? "bg-danger-light text-danger-dark" : "bg-slate-100 text-slate-600"
          )}
          role="status"
        >
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          <p>
            {isDisputed
              ? "This payment is in dispute. An administrator will review the evidence and decide within 24 hours. You will get an SMS when it is resolved."
              : "This payment was refunded. The money is on its way back to the account that paid."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * EscrowStatePill
 * WHAT: A tiny inline pill showing the state, for use inside list rows.
 * WHY : The full tracker is too big for a list; a coloured pill is enough.
 */
export function EscrowStatePill({ state }: { state: EscrowState }) {
  const tones: Record<EscrowState, string> = {
    PENDING_PAYMENT: "bg-slate-100 text-slate-600",
    HELD: "bg-primary-50 text-primary-700",
    CONFIRMED: "bg-gold-50 text-gold-800",
    RELEASED: "bg-success-light text-success-dark",
    DISPUTED: "bg-danger-light text-danger-dark",
    REFUNDED: "bg-slate-200 text-slate-600",
  };

  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tones[state])}>{stateLabel(state)}</span>;
}
