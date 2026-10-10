/**
 * src/components/ui/Money.tsx
 * WHAT: Displays money consistently - big prices, small price chips and
 *       line-item rows in a fee breakdown.
 * WHY : Prices appear on almost every screen. Formatting them in one component
 *       means no screen ever shows "₦45000" next to another showing "45,000".
 */
import { formatNaira, formatNairaCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Money
 * WHAT: A formatted Naira amount with optional size and colour control.
 * WHY : The main price on a card needs to be large and bold; a fee line needs to
 *       be small and muted. Same component, different props.
 */
export function Money({
  kobo,
  size = "md",
  className,
  suffix,
}: {
  kobo: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Small text after the amount, e.g. "/month" or "/year". */
  suffix?: string;
}) {
  const sizes = {
    xs: "text-[11px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
    xl: "text-2xl",
  } as const;

  return (
    <span className={cn("font-semibold tabular-nums text-slate-900", sizes[size], className)}>
      {formatNaira(kobo)}
      {suffix ? <span className="ml-0.5 font-normal text-slate-500">{suffix}</span> : null}
    </span>
  );
}

/**
 * MoneyChip
 * WHAT: A compact price pill, e.g. "₦45k/mo".
 * WHY : Filter chips and small cards have no room for a full amount.
 */
export function MoneyChip({ kobo, suffix, tone = "slate" }: { kobo: number; suffix?: string; tone?: "slate" | "primary" | "gold" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    primary: "bg-primary-50 text-primary-700",
    gold: "bg-gold-50 text-gold-800",
  } as const;

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums", tones[tone])}>
      {formatNairaCompact(kobo)}
      {suffix ? <span className="ml-0.5 font-normal opacity-70">{suffix}</span> : null}
    </span>
  );
}

/**
 * MoneyRow
 * WHAT: One line of a fee breakdown: label on the left, amount on the right.
 * WHY : The spec requires a full fee breakdown before payment. Every breakdown
 *       is built from these rows so they always align.
 */
export function MoneyRow({
  label,
  kobo,
  hint,
  muted = false,
  strong = false,
  tone = "default",
}: {
  label: string;
  kobo: number;
  hint?: string;
  muted?: boolean;
  strong?: boolean;
  /** "default" black, "success" green for money coming back, "danger" red for deductions. */
  tone?: "default" | "success" | "danger";
}) {
  const tones = {
    default: "text-slate-900",
    success: "text-success-dark",
    danger: "text-danger",
  } as const;

  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className={cn("text-sm", strong ? "font-semibold text-slate-900" : muted ? "text-slate-500" : "text-slate-700")}>
          {label}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
      </div>
      <span
        className={cn(
          "shrink-0 text-sm tabular-nums",
          strong ? "text-base font-bold" : "font-semibold",
          tones[tone]
        )}
      >
        {/* A leading minus makes a deduction obvious. */}
        {tone === "danger" && kobo > 0 ? "-" : ""}
        {formatNaira(kobo)}
      </span>
    </div>
  );
}

/**
 * MoneyTotal
 * WHAT: The bold total line with a rule above it.
 * WHY : The total is the number the user is agreeing to. It must be visually
 *       separate from the line items above it.
 */
export function MoneyTotal({ label, kobo, hint }: { label: string; kobo: number; hint?: string }) {
  return (
    <div className="mt-1 border-t border-slate-200 pt-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{label}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
        <span className="text-xl font-extrabold tabular-nums text-primary-700">{formatNaira(kobo)}</span>
      </div>
    </div>
  );
}
