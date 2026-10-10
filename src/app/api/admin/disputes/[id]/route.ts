/**
 * src/app/api/admin/disputes/[id]/route.ts
 * WHAT: An admin resolves a dispute - either refund the payer or release the
 *       money to the seller.
 * WHY : This is the most sensitive action in the product: it decides who keeps
 *       real money. It must be logged, must notify both sides, and must move the
 *       escrow to a final state.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { moveEscrow } from "@/lib/escrow";
import { notify } from "@/lib/notifications";
import { formatNaira } from "@/lib/money";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, resolveDisputeSchema } from "@/lib/validators";

type RouteContext = { params: { id: string } };

/**
 * PATCH /api/admin/disputes/:id
 * Body: { decision: "RESOLVED_FOR_PAYER" | "RESOLVED_FOR_PAYEE", resolution }
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    const body = await readJson(request);
    const parsed = safeParse(resolveDisputeSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const dispute = await prisma.dispute.findUnique({
      where: { id: context.params.id },
      include: {
        escrow: {
          include: {
            payer: { select: { id: true, fullName: true } },
            payee: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!dispute) return fail("That dispute was not found.", 404);
    if (dispute.status === "RESOLVED_FOR_PAYER" || dispute.status === "RESOLVED_FOR_PAYEE") {
      return fail("This dispute has already been resolved.", 409);
    }

    const { decision, resolution } = parsed.data;
    const escrow = dispute.escrow;

    // -----------------------------------------------------------------
    // 1. Record the decision.
    // -----------------------------------------------------------------
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status: decision,
        resolution,
        resolvedAt: new Date(),
        assignedToId: admin.id,
      },
    });

    // -----------------------------------------------------------------
    // 2. Move the money.
    // -----------------------------------------------------------------
    if (decision === "RESOLVED_FOR_PAYER") {
      // The buyer gets their money back.
      await moveEscrow(escrow.id, "REFUNDED");

      // Put a reserved item back on the market.
      if (escrow.marketItemId) {
        await prisma.marketItem.update({ where: { id: escrow.marketItemId }, data: { status: "AVAILABLE" } }).catch(() => null);
      }
    } else {
      // The seller keeps the money. It moves to CONFIRMED and is released by the
      // normal release flow (or immediately if Flutterwave is configured).
      await moveEscrow(escrow.id, "RELEASED");
      await prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: { releasedAt: new Date() },
      });
    }

    // -----------------------------------------------------------------
    // 3. Tell both sides, with the admin's explanation.
    // -----------------------------------------------------------------
    const payerWon = decision === "RESOLVED_FOR_PAYER";

    await notify({
      userId: escrow.payerId,
      title: payerWon ? "Dispute resolved in your favour ✅" : "Dispute resolved",
      body: payerWon
        ? `${formatNaira(escrow.totalKobo)} will be refunded to you. Reason: ${resolution}`
        : `The money was released to the seller. Reason: ${resolution}`,
      link: `/escrow/${escrow.id}`,
      sms: true,
      smsBody: payerWon
        ? `Mobile Campus: your dispute on ${escrow.reference} was resolved in your favour. ${formatNaira(escrow.totalKobo)} is being refunded.`
        : `Mobile Campus: the dispute on ${escrow.reference} was resolved. The payment was released to the seller.`,
    });

    await notify({
      userId: escrow.payeeId,
      title: payerWon ? "Dispute resolved" : "Dispute resolved in your favour ✅",
      body: payerWon
        ? `The payment was refunded to the buyer. Reason: ${resolution}`
        : `${formatNaira(escrow.payoutKobo)} is being released to you. Reason: ${resolution}`,
      link: "/escrow",
      sms: true,
      smsBody: payerWon
        ? `Mobile Campus: the dispute on ${escrow.reference} was resolved and the buyer was refunded.`
        : `Mobile Campus: the dispute on ${escrow.reference} was resolved in your favour. ${formatNaira(escrow.payoutKobo)} is on its way.`,
    });

    return json({ id: dispute.id, status: decision, escrowState: payerWon ? "REFUNDED" : "RELEASED" });
  } catch (error) {
    return handleError(error);
  }
}
