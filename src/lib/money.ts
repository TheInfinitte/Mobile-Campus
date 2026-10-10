/**
 * src/lib/money.ts
 * WHAT: All money maths and Naira formatting in one file.
 * WHY : Money bugs are the worst kind of bug. Keeping conversion and rounding
 *       in one place means we never accidentally mix naira and kobo or use
 *       floating-point arithmetic on money.
 *
 * RULE: Everything stored in the database is KOBO (a whole number).
 *       1 naira = 100 kobo.
 */

/** Converts naira (may have decimals) to kobo (always a whole number). */
export function toKobo(nairaAmount: number): number {
  if (!Number.isFinite(nairaAmount)) return 0;
  // Math.round avoids the classic 0.1 + 0.2 floating point surprise.
  return Math.round(nairaAmount * 100);
}

/** Converts kobo back to naira for display and arithmetic. */
export function toNaira(kobo: number): number {
  return (kobo ?? 0) / 100;
}

/**
 * formatNaira
 * WHAT: Formats kobo as a Nigerian Naira string, e.g. 15000000 -> "₦150,000".
 * WHY : Every price on screen must look the same and be easy to read on a
 *       small phone.
 *
 * `withKobo` keeps the decimals when they matter (rare, for fee maths).
 */
export function formatNaira(kobo: number, withKobo = false): string {
  const value = toNaira(kobo);
  return value.toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: withKobo ? 2 : 0,
    maximumFractionDigits: withKobo ? 2 : 0,
  });
}

/**
 * formatNairaCompact
 * WHAT: Short money text for tight spaces, e.g. 15000000 -> "₦150k".
 * WHY : Cards and chips on mobile have very little room for long numbers.
 */
export function formatNairaCompact(kobo: number): string {
  const naira = toNaira(kobo);
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(naira % 1_000_000 === 0 ? 0 : 1)}m`;
  if (naira >= 1_000) return `₦${(naira / 1_000).toFixed(naira % 1_000 === 0 ? 0 : 1)}k`;
  return `₦${naira}`;
}

/**
 * parseNairaInput
 * WHAT: Turns whatever the user typed into a kobo amount.
 *       Handles: "150k", "150K", "₦150,000", "150000", "1.5m", "80k".
 * WHY : Nigerian users type money in many ways. The AI assistant and the
 *       budget form must understand all of them.
 *
 * Returns 0 when nothing sensible can be read.
 */
export function parseNairaInput(raw: string | number): number {
  if (typeof raw === "number") return toKobo(raw);

  // Lowercase and strip currency symbols, spaces and commas.
  const text = String(raw).toLowerCase().replace(/[₦n,\s]/g, "");
  if (!text) return 0;

  // Match an optional decimal number followed by an optional k/m suffix.
  const match = text.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!match) return 0;

  const amount = Number(match[1]);
  const suffix = match[2];

  if (suffix === "k") return toKobo(amount * 1_000);      // 150k = 150,000 naira
  if (suffix === "m") return toKobo(amount * 1_000_000);  // 1.5m = 1,500,000 naira
  return toKobo(amount);                                  // plain naira
}

/**
 * percentOf
 * WHAT: Calculates a percentage of a kobo amount, rounded to whole kobo.
 * WHY : Fee maths must be predictable. We round half-up so ₦0.005 becomes ₦0.01.
 */
export function percentOf(kobo: number, percent: number): number {
  return Math.round((kobo * percent) / 100);
}

/**
 * clampFee
 * WHAT: Applies a minimum and maximum to a calculated fee.
 * WHY : A ₦2,000 item at 3% is ₦60, which does not even cover Flutterwave's
 *       own charge. The minimum fee keeps us from losing money on small deals.
 *       A maximum stops a big rental from being charged an unreasonable fee.
 */
export function clampFee(feeKobo: number, minimumKobo: number, maximumKobo: number): number {
  let fee = feeKobo;
  if (minimumKobo > 0 && fee < minimumKobo) fee = minimumKobo;
  if (maximumKobo > 0 && fee > maximumKobo) fee = maximumKobo;
  return fee;
}

/**
 * makeReference
 * WHAT: Creates a short, unique, human-friendly reference like "MC-8F3K2A".
 * WHY : Users read references over the phone to support. Long random ids are
 *       impossible to spell out.
 */
export function makeReference(prefix = "MC"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0/O/1/I to avoid confusion.
  let out = "";
  const bytes = new Uint8Array(6);
  // Use the web crypto API when available (works in the Edge runtime too).
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < bytes.length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${out}`;
}

/**
 * moneySummary
 * WHAT: Adds up the parts of a deal into one clean object.
 * WHY : The fee breakdown UI and the escrow record must show exactly the same
 *       numbers. Computing them once here guarantees that.
 */
export function moneySummary(parts: {
  itemKobo: number;
  cautionKobo?: number;
  feeKobo?: number;
  extraKobo?: number;
}): { itemKobo: number; cautionKobo: number; feeKobo: number; extraKobo: number; totalKobo: number } {
  const itemKobo = Math.max(0, parts.itemKobo);
  const cautionKobo = Math.max(0, parts.cautionKobo ?? 0);
  const feeKobo = Math.max(0, parts.feeKobo ?? 0);
  const extraKobo = Math.max(0, parts.extraKobo ?? 0);
  return {
    itemKobo,
    cautionKobo,
    feeKobo,
    extraKobo,
    totalKobo: itemKobo + cautionKobo + feeKobo + extraKobo,
  };
}
