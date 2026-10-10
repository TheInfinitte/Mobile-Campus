/**
 * src/components/escrow/FeeBreakdown.tsx
 * WHAT: Shows every part of what the user is about to pay: the item or rent, the
 *       caution deposit, the Mobile Campus fee, and the total.
 * WHY : The product rule is explicit - ALWAYS show a full fee breakdown before
 *       the user pays. No hidden charges, ever. This component is rendered on
 *       the payment sheet for housing, market purchases and gigs.
 */
import { formatNaira } from "@/lib/money";
import { MoneyRow, MoneyTotal } from "@/components/ui/Money";
import { InfoIcon, LockIcon } from "@/components/ui/Icons";

/** One line of the breakdown, as returned by the pricing API. */
export type FeeLineInput = {
  key: string;
  label: string;
  amountKobo: number;
  note?: string;
};

type FeeBreakdownProps = {
  /** What is being paid for, e.g. "12 months rent" or "Binatone standing fan". */
  itemLabel: string;
  itemKobo: number;
  cautionKobo?: number;
  /** Extra costs such as suggested move-in items. */
  extraLabel?: string;
  extraKobo?: number;
  /** The platform fee lines from the server. */
  feeLines: FeeLineInput[];
  /** The final amount the user pays. */
  totalKobo: number;
  /** What the seller/landlord will receive, shown for transparency. */
  payoutKobo?: number;
  /** Optional note shown under the total. */
  note?: string;
};

/**
 * FeeBreakdown
 * WHAT: Renders the itemised list plus the total.
 * WHY : One component means the housing payment sheet and the market payment
 *       sheet can never disagree about how fees are presented.
 */
export function FeeBreakdown({
  itemLabel,
  itemKobo,
  cautionKobo = 0,
  extraLabel,
  extraKobo = 0,
  feeLines,
  totalKobo,
  payoutKobo,
  note,
}: FeeBreakdownProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {/* Header explaining what this is. */}
      <div className="mb-2 flex items-center gap-2">
        <InfoIcon size={16} className="text-slate-400" />
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Full fee breakdown</p>
      </div>

      {/* The main item. */}
      <MoneyRow label={itemLabel} kobo={itemKobo} />

      {/* Caution deposit (rentals only) - always refundable, so we say so. */}
      {cautionKobo > 0 ? (
        <MoneyRow
          label="Caution deposit"
          kobo={cautionKobo}
          hint="Refundable when you move out in good condition"
          muted
        />
      ) : null}

      {/* Optional extras, e.g. suggested move-in items. */}
      {extraKobo > 0 && extraLabel ? <MoneyRow label={extraLabel} kobo={extraKobo} hint="Optional - you can skip these" muted /> : null}

      {/* The platform fees, exactly as the server calculated them. */}
      {feeLines.map((line) => (
        <MoneyRow
          key={line.key}
          label={line.label}
          // Fees charged to the landlord/seller are shown as deductions, so they
          // are only displayed for information and are not added to the total.
          kobo={line.key.includes("LANDLORD") || line.key === "TRANSFER" ? line.amountKobo : line.amountKobo}
          hint={line.note}
          muted
          tone={line.key.includes("LANDLORD") || line.key === "TRANSFER" ? "danger" : "default"}
        />
      ))}

      {/* The number the user is agreeing to pay. */}
      <MoneyTotal label="You pay now" kobo={totalKobo} hint={note ?? "Charged once, through Flutterwave"} />

      {/* Escrow reassurance - the most important sentence on this screen. */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary-50 p-3">
        <LockIcon size={16} className="mt-0.5 shrink-0 text-primary-700" />
        <p className="text-[11px] leading-relaxed text-primary-900">
          Your money is held in escrow{payoutKobo ? ` and ${formatNaira(payoutKobo)} is released to the seller only after you confirm` : ""}.
          If something is wrong, open a dispute before confirming and we will review it.
        </p>
      </div>
    </div>
  );
}
