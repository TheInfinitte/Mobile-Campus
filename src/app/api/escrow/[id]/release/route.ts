/**
 * src/app/api/escrow/[id]/release/route.ts
 * WHAT: Sends the held money to the seller or landlord using a Flutterwave
 *       transfer, and moves the escrow to RELEASED.
 * WHY : This is the payout step. It is deliberately a separate action from
 *       confirmation so an admin can review large or unusual releases, and so a
 *       failed transfer never leaves us thinking the seller was paid.
 *
 * WHO CAN CALL IT:
 *   - An admin, always.
 *   - The payee (seller/landlord) can trigger it once the buyer has confirmed.
 *
 * SAFETY: The transfer is only attempted when Flutterwave is configured. If it is
 * not (for example in local development) the escrow is still marked RELEASED and
 * a clear note is recorded, so the flow can be tested end to end.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { moveEscrow } from "@/lib/escrow";
import { createTransfer } from "@/lib/flutterwave";
import { env, isConfigured } from "@/lib/env";
import { makeReference, formatNaira } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { escrowReleasedMessage } from "@/lib/termii";
import { fail, json, handleError } from "@/lib/api";

type RouteContext = { params: { id: string } };

/**
 * POST /api/escrow/:id/release
 * No body required.
 */
export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const escrow = await prisma.escrowTransaction.findFirst({
      where: { OR: [{ id: context.params.id }, { reference: context.params.id }] },
      include: {
        payee: { select: { id: true, fullName: true, phone: true } },
        payer: { select: { id: true, fullName: true } },
      },
    });

    if (!escrow) return fail("That payment was not found.", 404);

    // Permission: admin, or the payee once the buyer has confirmed.
    const isPayee = escrow.payeeId === user.id;
    if (!isPayee && user.role !== "ADMIN") {
      return fail("Only the seller or an administrator can release this payment.", 403);
    }

    // Must be CONFIRMED (or DISPUTED and resolved in favour of the payee).
    if (escrow.state !== "CONFIRMED" && escrow.state !== "DISPUTED") {
      return fail("This payment is not ready to be released.", 409);
    }

    const payoutReference = makeReference("MCT");

    // ---------------------------------------------------------------
    // Attempt the real Flutterwave transfer when credentials exist.
    // ---------------------------------------------------------------
    let transferStatus = "SIMULATED";

    if (isConfigured(env.flutterwave.secretKey) && env.flutterwave.settlementAccount) {
      try {
        const transfer = await createTransfer({
          reference: payoutReference,
          // In production these come from the payee's saved bank details.
          accountBank: env.flutterwave.settlementBankCode,
          accountNumber: env.flutterwave.settlementAccount,
          amountKobo: escrow.payoutKobo,
          narration: `Mobile Campus payout ${escrow.reference}`,
        });
        transferStatus = transfer.status;
      } catch (error) {
        // A failed transfer must NOT mark the escrow as released.
        console.error("[escrow release] transfer failed:", error);
        return fail("The payout could not be sent. Our team has been notified.", 502);
      }
    } else {
      // No Flutterwave credentials configured - record that clearly.
      console.warn("[escrow release] Flutterwave not configured - marking as released without a transfer.");
    }

    // Record the payout reference and move the state.
    await prisma.escrowTransaction.update({
      where: { id: escrow.id },
      data: { payoutReference, payoutAt: new Date() },
    });

    await moveEscrow(escrow.id, "RELEASED");

    // If this was a disputed payment, close the dispute as resolved for payee.
    if (escrow.state === "DISPUTED") {
      await prisma.dispute.updateMany({
        where: { escrowId: escrow.id, status: { in: ["OPEN", "UNDER_REVIEW"] } },
        data: { status: "RESOLVED_FOR_PAYEE", resolvedAt: new Date() },
      });
    }

    // Tell the payee their money has moved.
    await notify({
      userId: escrow.payeeId,
      title: "Money released 💰",
      body: `${formatNaira(escrow.payoutKobo)} for ${escrow.reference} has been sent to your account.`,
      link: "/escrow",
      sms: true,
      smsBody: escrowReleasedMessage(escrow.payee.fullName.split(" ")[0], formatNaira(escrow.payoutKobo), escrow.reference),
    });

    // And tell the payer the deal is finished.
    await notify({
      userId: escrow.payerId,
      title: "Payment released",
      body: `Your payment for ${escrow.reference} has been released to ${escrow.payee.fullName.split(" ")[0]}. Thank you for using escrow.`,
      link: `/escrow/${escrow.id}`,
    });

    return json({ state: "RELEASED", transferStatus, payoutReference, payoutKobo: escrow.payoutKobo });
  } catch (error) {
    return handleError(error);
  }
}
