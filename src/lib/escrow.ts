/**
 * src/lib/escrow.ts
 * WHAT: The server-side half of escrow - pricing a deal, creating it, and moving
 *       it through the state machine. The state machine itself and the display
 *       helpers live in escrow-state.ts.
 * WHY : Money movement must be predictable. If we allowed "RELEASED" to go back
 *       to "HELD", a bug or a double-click could release the same money twice.
 *       Keeping the pure state rules in a separate file also keeps the database
 *       out of the browser bundle.
 */
import { prisma } from "./prisma";
import { ApiError } from "./auth";
import { escrowFeeBreakdown, housingFeeBreakdown, payoutFee } from "./fees";
import { makeReference } from "./money";
import type { EscrowState, EscrowType } from "@prisma/client";

// The state machine and the display helpers live in escrow-state.ts so client
// components can import them without pulling the database into the browser
// bundle. They are re-exported here so server code can keep using "@/lib/escrow".
export {
  canTransition,
  escrowSteps,
  stepIndex,
  stateColor,
  stateLabel,
  describeState,
  // Not re-exported: assertTransition throws a plain Error here, and server
  // callers need the ApiError wrapper defined below instead.
} from "./escrow-state";
import { assertTransition } from "./escrow-state";

/**
 * priceEscrow
 * WHAT: Works out the exact amounts for a new deal: price, fees, total to pay,
 *       and what the seller will receive.
 * WHY : The UI shows this BEFORE payment, and the same numbers are saved on the
 *       escrow row so they can never disagree later.
 */
export async function priceEscrow(input: {
  type: EscrowType;
  itemKobo: number;
  cautionKobo?: number;
}): Promise<{
  itemKobo: number;
  cautionKobo: number;
  payerFeeKobo: number;
  payeeFeeKobo: number;
  payoutFeeKobo: number;
  totalKobo: number;
  payoutKobo: number;
  feeSnapshot: string;
  lines: { key: string; label: string; amountKobo: number; note?: string }[];
}> {
  const itemKobo = Math.max(0, input.itemKobo);
  const cautionKobo = Math.max(0, input.cautionKobo ?? 0);

  // Housing uses the 2% split commission; everything else uses the 3% escrow fee.
  const breakdown = input.type === "RENT"
    ? await housingFeeBreakdown(itemKobo)
    : await escrowFeeBreakdown(itemKobo);

  const transferFee = await payoutFee();

  // What the buyer actually pays.
  const totalKobo = itemKobo + cautionKobo + breakdown.payerFeeKobo;

  // What the seller/landlord receives: their share minus their fee and payout cost.
  // For housing the "item" is rent; the caution deposit is always passed on in full.
  const payoutKobo = Math.max(
    0,
    itemKobo + cautionKobo - breakdown.payeeFeeKobo - transferFee
  );

  return {
    itemKobo,
    cautionKobo,
    payerFeeKobo: breakdown.payerFeeKobo,
    payeeFeeKobo: breakdown.payeeFeeKobo,
    payoutFeeKobo: transferFee,
    totalKobo,
    payoutKobo,
    feeSnapshot: breakdown.lines
      .map((line) => `${line.key}=${line.amountKobo}`)
      .join(",") || "none",
    lines: [
      ...breakdown.lines,
      ...(transferFee > 0
        ? [{ key: "TRANSFER", label: "Payout fee (deducted from seller)", amountKobo: transferFee }]
        : []),
    ],
  };
}

/**
 * createEscrow
 * WHAT: Creates an escrow row in PENDING_PAYMENT with a fresh reference.
 * WHY : We create the record BEFORE the user pays so we can match the
 *       Flutterwave callback back to the right deal.
 */
export async function createEscrow(input: {
  type: EscrowType;
  payerId: string;
  payeeId: string;
  itemKobo: number;
  cautionKobo?: number;
  lodgeId?: string | null;
  marketItemId?: string | null;
  gigId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}): Promise<{ id: string; reference: string; totalKobo: number; payoutKobo: number }> {
  if (input.payerId === input.payeeId) {
    throw new ApiError(400, "You cannot pay yourself.");
  }

  const pricing = await priceEscrow({
    type: input.type,
    itemKobo: input.itemKobo,
    cautionKobo: input.cautionKobo,
  });

  const escrow = await prisma.escrowTransaction.create({
    data: {
      reference: makeReference("MC"),
      type: input.type,
      state: "PENDING_PAYMENT",
      payerId: input.payerId,
      payeeId: input.payeeId,
      lodgeId: input.lodgeId ?? null,
      marketItemId: input.marketItemId ?? null,
      gigId: input.gigId ?? null,
      itemAmountKobo: pricing.itemKobo,
      cautionKobo: pricing.cautionKobo,
      feeKobo: pricing.payerFeeKobo + pricing.payeeFeeKobo,
      totalKobo: pricing.totalKobo,
      payoutKobo: pricing.payoutKobo,
      feeSnapshot: pricing.feeSnapshot,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
    },
  });

  return {
    id: escrow.id,
    reference: escrow.reference,
    totalKobo: escrow.totalKobo,
    payoutKobo: escrow.payoutKobo,
  };
}

/**
 * moveEscrow
 * WHAT: Moves an escrow to a new state after checking the transition is legal.
 * WHY : Every state change (confirm, release, refund, dispute) goes through
 *       here, so there is exactly one place to audit.
 */
export async function moveEscrow(id: string, to: EscrowState): Promise<void> {
  const escrow = await prisma.escrowTransaction.findUnique({ where: { id } });
  if (!escrow) throw new ApiError(404, "That payment record was not found.");

  try {
    assertTransition(escrow.state, to);
  } catch (error) {
    // Turn the plain state-machine Error into a 409 with the same message.
    throw new ApiError(409, error instanceof Error ? error.message : "That move is not allowed.");
  }

  await prisma.escrowTransaction.update({
    where: { id },
    data: {
      state: to,
      // Stamp the time for the states that need an audit timestamp.
      confirmedAt: to === "CONFIRMED" ? new Date() : undefined,
      releasedAt: to === "RELEASED" ? new Date() : undefined,
      refundedAt: to === "REFUNDED" ? new Date() : undefined,
    },
  });
}
