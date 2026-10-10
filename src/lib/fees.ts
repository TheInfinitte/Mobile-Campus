/**
 * src/lib/fees.ts
 * WHAT: Calculates every platform fee by reading the FeeConfig table.
 * WHY : The product rule is strict - fees are NEVER hard-coded. If the business
 *       wants to change the escrow fee from 3% to 2.5%, an admin edits a row in
 *       the database and the whole app follows, with no redeploy.
 *
 * FEE MODEL:
 *   Housing booking commission = 2% total, split equally (1% tenant, 1% landlord).
 *   Escrow fee = 3% (who pays it is configurable via FeePayer).
 *   A configurable minimum fee makes sure tiny transactions still cover
 *   Flutterwave's own cost.
 */
import { prisma } from "./prisma";
import { clampFee, percentOf, toNaira } from "./money";
import type { FeeConfig } from "@prisma/client";

/** One line of a fee breakdown that we can show to the user. */
export type FeeLine = {
  key: string;        // Machine key, e.g. "HOUSING_TENANT".
  label: string;      // Human label, e.g. "Mobile Campus fee (tenant)".
  amountKobo: number; // The money.
  note?: string;      // Optional explanation, e.g. "1% of ₦45,000".
};

/** The result of a fee calculation for one deal. */
export type FeeBreakdown = {
  lines: FeeLine[];      // Every fee shown to the user.
  payerFeeKobo: number;  // Total the buyer/tenant pays on top of the price.
  payeeFeeKobo: number;  // Total deducted from the seller/landlord's payout.
  totalFeeKobo: number;  // Everything Mobile Campus earns on this deal.
};

/**
 * getFeeConfigs
 * WHAT: Loads all active fee rules from the database.
 * WHY : Called by every pricing calculation. Cached for 60 seconds so we do not
 *       hit the database on every page view.
 */
let feeCache: { at: number; rows: FeeConfig[] } | null = null;
const FEE_CACHE_MS = 60 * 1000;

export async function getFeeConfigs(): Promise<FeeConfig[]> {
  const now = Date.now();
  if (feeCache && now - feeCache.at < FEE_CACHE_MS) return feeCache.rows;

  const rows = await prisma.feeConfig.findMany({ where: { isActive: true } });
  feeCache = { at: now, rows };
  return rows;
}

/**
 * clearFeeCache
 * WHAT: Drops the cached fee rows.
 * WHY : Called by the admin FeeConfig editor so changes apply immediately.
 */
export function clearFeeCache(): void {
  feeCache = null;
}

/**
 * findFee
 * WHAT: Picks one fee rule out of the list by its key.
 * WHY : Small helper so the maths below stays readable.
 */
function findFee(rows: FeeConfig[], key: string): FeeConfig | undefined {
  return rows.find((row) => row.key === key);
}

/**
 * calculateAmount
 * WHAT: Turns one fee rule into a real kobo amount.
 * WHY : Percent + fixed + min/max clamping is the same logic everywhere.
 */
function calculateAmount(rule: FeeConfig, baseKobo: number): number {
  const raw = percentOf(baseKobo, rule.percent) + rule.fixedKobo;
  return clampFee(raw, rule.minimumKobo, rule.maximumKobo);
}

/**
 * housingFeeBreakdown
 * WHAT: The 2% housing commission, split 1% tenant and 1% landlord.
 * WHY : Both sides must see their own share before anyone pays.
 *
 * `baseKobo` is normally the rent for the period being booked (caution deposit
 * is excluded, because it is refundable and not a commission-able amount).
 */
export async function housingFeeBreakdown(baseKobo: number): Promise<FeeBreakdown> {
  const rows = await getFeeConfigs();
  const tenantRule = findFee(rows, "HOUSING_TENANT");
  const landlordRule = findFee(rows, "HOUSING_LANDLORD");

  const lines: FeeLine[] = [];

  // Tenant side (added to what the tenant pays).
  const tenantFee = tenantRule ? calculateAmount(tenantRule, baseKobo) : 0;
  if (tenantRule) {
    lines.push({
      key: tenantRule.key,
      label: tenantRule.label,
      amountKobo: tenantFee,
      note: `${tenantRule.percent}% of the booking`,
    });
  }

  // Landlord side (deducted from the landlord's payout, not charged to the tenant).
  const landlordFee = landlordRule ? calculateAmount(landlordRule, baseKobo) : 0;
  if (landlordRule) {
    lines.push({
      key: landlordRule.key,
      label: landlordRule.label,
      amountKobo: landlordFee,
      note: `${landlordRule.percent}% deducted from the landlord payout`,
    });
  }

  return {
    lines,
    payerFeeKobo: tenantFee,
    payeeFeeKobo: landlordFee,
    totalFeeKobo: tenantFee + landlordFee,
  };
}

/**
 * escrowFeeBreakdown
 * WHAT: The 3% escrow protection fee for market purchases and gigs.
 * WHY : The payer is configurable (FeePayer). If it is set to PAYEE we show it
 *       as a deduction from the seller instead of a charge to the buyer.
 */
export async function escrowFeeBreakdown(baseKobo: number): Promise<FeeBreakdown> {
  const rows = await getFeeConfigs();
  const rule = findFee(rows, "ESCROW");

  if (!rule) {
    return { lines: [], payerFeeKobo: 0, payeeFeeKobo: 0, totalFeeKobo: 0 };
  }

  const amount = calculateAmount(rule, baseKobo);
  const isPayerCharged = rule.payer === "PAYER" || rule.payer === "SPLIT";
  const payerFee = rule.payer === "SPLIT" ? Math.round(amount / 2) : isPayerCharged ? amount : 0;
  const payeeFee = amount - payerFee; // Whatever the buyer does not pay, the seller does.

  return {
    lines: [
      {
        key: rule.key,
        label: rule.label,
        amountKobo: amount,
        note: rule.payer === "PAYER"
          ? `${rule.percent}% paid by you`
          : rule.payer === "PAYEE"
            ? `${rule.percent}% deducted from the seller`
            : `${rule.percent}% shared between buyer and seller`,
      },
    ],
    payerFeeKobo: payerFee,
    payeeFeeKobo: payeeFee,
    totalFeeKobo: amount,
  };
}

/**
 * payoutFee
 * WHAT: The fixed cost of sending money out to a seller or landlord.
 * WHY : Flutterwave charges per transfer. We deduct it from the payout so the
 *       platform never pays out of its own pocket.
 */
export async function payoutFee(): Promise<number> {
  const rows = await getFeeConfigs();
  const rule = findFee(rows, "TRANSFER");
  if (!rule) return 0;
  return rule.fixedKobo > 0 ? rule.fixedKobo : calculateAmount(rule, 0);
}

/**
 * totalForPayer
 * WHAT: The single number shown on the "Pay" button.
 * WHY : The user must always see the full amount - price + caution + fees -
 *       before they are taken to Flutterwave. No surprises.
 */
export function totalForPayer(parts: {
  itemKobo: number;
  cautionKobo?: number;
  payerFeeKobo: number;
  extraKobo?: number;
}): number {
  return (
    Math.max(0, parts.itemKobo) +
    Math.max(0, parts.cautionKobo ?? 0) +
    Math.max(0, parts.payerFeeKobo) +
    Math.max(0, parts.extraKobo ?? 0)
  );
}

/**
 * describeBreakdown
 * WHAT: Turns a breakdown into plain English lines for SMS/notifications.
 * WHY : Notifications cannot render a table, so we need a text version.
 */
export function describeBreakdown(breakdown: FeeBreakdown): string {
  if (breakdown.lines.length === 0) return "No platform fees.";
  return breakdown.lines
    .map((line) => `${line.label}: ₦${toNaira(line.amountKobo).toLocaleString("en-NG")}`)
    .join(" • ");
}
