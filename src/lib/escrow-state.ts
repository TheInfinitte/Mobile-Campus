/**
 * src/lib/escrow-state.ts
 * WHAT: The escrow state machine and the display helpers that go with it -
 *       which moves are legal, the tracker steps, and the plain-English label,
 *       colour and explanation for each state.
 * WHY : This file has NO imports of its own beyond the Prisma type, so client
 *       components can use it safely. The heavier half of the escrow logic
 *       (src/lib/escrow.ts) talks to the database and to the session cookie, and
 *       must never be pulled into a browser bundle - that is why the two are
 *       split.
 *
 * THE SIX STATES:
 *   PENDING_PAYMENT -> HELD -> CONFIRMED -> RELEASED
 *                     HELD -> DISPUTED -> RELEASED | REFUNDED
 */
import type { EscrowState } from "@prisma/client";

/** Which states each state may legally move to. */
const TRANSITIONS: Record<EscrowState, EscrowState[]> = {
  PENDING_PAYMENT: ["HELD"],
  HELD: ["CONFIRMED", "DISPUTED", "REFUNDED"],
  CONFIRMED: ["RELEASED", "DISPUTED"],
  RELEASED: [],
  DISPUTED: ["RELEASED", "REFUNDED"],
  REFUNDED: [],
};

/**
 * canTransition
 * WHAT: Returns true if moving from `from` to `to` is allowed.
 * WHY : One guard used by every escrow action.
 */
export function canTransition(from: EscrowState, to: EscrowState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * assertTransition
 * WHAT: Throws for an illegal move, with a message a student can understand.
 * WHY : The API turns this into a 409 (conflict) response instead of silently
 *       corrupting money. It throws a plain Error because this module must stay
 *       importable from the browser; the server-side wrapper in escrow.ts is
 *       what attaches the HTTP status.
 */
export function assertTransition(from: EscrowState, to: EscrowState): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `This payment is ${from.replace("_", " ").toLowerCase()} and cannot be moved to ${to.replace("_", " ").toLowerCase()}.`
    );
  }
}

/**
 * escrowSteps
 * WHAT: The ordered progress steps used by the animated escrow tracker.
 * WHY : The UI needs a fixed list to draw the progress bar and to know which
 *       step is "done", "current" or "pending".
 */
export const escrowSteps: { key: EscrowState; label: string; hint: string }[] = [
  { key: "PENDING_PAYMENT", label: "Payment", hint: "You pay into escrow" },
  { key: "HELD", label: "Held safely", hint: "Money is protected" },
  { key: "CONFIRMED", label: "Confirmed", hint: "You confirm delivery" },
  { key: "RELEASED", label: "Released", hint: "Seller is paid" },
];

/**
 * stepIndex
 * WHAT: Position of a state in the tracker (0-3). DISPUTED/REFUNDED sit at 1
 *       because they branch off after the money is held.
 * WHY : The animated tracker needs a number to fill the bar to.
 */
export function stepIndex(state: EscrowState): number {
  switch (state) {
    case "PENDING_PAYMENT":
      return 0;
    case "HELD":
    case "DISPUTED":
    case "REFUNDED":
      return 1;
    case "CONFIRMED":
      return 2;
    case "RELEASED":
      return 3;
    default:
      return 0;
  }
}

/** Human-friendly colours for each state, used by badges and the tracker. */
export const stateColor: Record<EscrowState, string> = {
  PENDING_PAYMENT: "bg-slate-100 text-slate-700",
  HELD: "bg-primary-50 text-primary-700",
  CONFIRMED: "bg-gold-100 text-gold-800",
  RELEASED: "bg-success-light text-success-dark",
  DISPUTED: "bg-danger-light text-danger-dark",
  REFUNDED: "bg-slate-200 text-slate-700",
};

/** Plain-English label for a state. */
export function stateLabel(state: EscrowState): string {
  switch (state) {
    case "PENDING_PAYMENT": return "Waiting for payment";
    case "HELD": return "Money held safely";
    case "CONFIRMED": return "Confirmed by you";
    case "RELEASED": return "Released to seller";
    case "DISPUTED": return "In dispute";
    case "REFUNDED": return "Refunded";
    default: return state;
  }
}

/**
 * describeState
 * WHAT: One plain-English sentence explaining what a given escrow state means.
 * WHY : "HELD" tells a student nothing. "Your money is safe with us" does. The
 *       sentence differs for the payer and the payee because they are waiting on
 *       different things.
 */
export function describeState(state: EscrowState, iAmPayer: boolean): string {
  switch (state) {
    case "PENDING_PAYMENT":
      return iAmPayer
        ? "Nothing has been paid yet. The money will only leave your account when you complete the payment."
        : "The buyer has not paid yet. You will be told the moment the money is held.";
    case "HELD":
      return iAmPayer
        ? "Your money is safe with us. Check the item or the room, then confirm so the other person gets paid."
        : "The money is with us, not with the buyer. Once they confirm, it is yours.";
    case "CONFIRMED":
      return iAmPayer
        ? "You confirmed. The money is being released to the other person now."
        : "The buyer confirmed. Collect the payment and it will be sent to your bank account.";
    case "RELEASED":
      return iAmPayer
        ? "The money has been sent to the other person. This payment is complete."
        : "The money has been sent to your bank account. This payment is complete.";
    case "DISPUTED":
      return "A dispute is open on this payment. The money is frozen and cannot move until our team decides who it belongs to.";
    case "REFUNDED":
      return iAmPayer
        ? "Your money has been refunded to you. Nothing further is needed."
        : "This payment was refunded to the buyer.";
    default:
      return "";
  }
}
