/**
 * src/app/api/escrow/[id]/route.ts
 * WHAT: Returns one escrow deal in full detail, with every timestamp, fee line
 *       and the current state.
 * WHY : The escrow detail page is the "receipt" a user shows when something goes
 *       wrong. It must contain the complete history.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, json, handleError } from "@/lib/api";

type RouteContext = { params: { id: string } };

/**
 * GET /api/escrow/:id
 * Accepts either the escrow id or the human-friendly reference (MC-XXXXXX),
 * because users read references out loud to support.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const idOrReference = context.params.id;

    // Try the id first, then the reference.
    const escrow = await prisma.escrowTransaction.findFirst({
      where: { OR: [{ id: idOrReference }, { reference: idOrReference }] },
      include: {
        lodge: { select: { id: true, title: true, area: true, address: true, caretakerName: true, caretakerPhone: true } },
        marketItem: { select: { id: true, title: true, images: true, category: true, area: true, pickupNote: true } },
        gig: { select: { id: true, title: true, category: true, description: true } },
        payer: { select: { id: true, fullName: true, phone: true } },
        payee: { select: { id: true, fullName: true, phone: true } },
        dispute: true,
        splitShares: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!escrow) return fail("That payment was not found.", 404);

    // Only the two parties (or an admin) may see a deal.
    const allowed = escrow.payerId === user.id || escrow.payeeId === user.id || user.role === "ADMIN";
    if (!allowed) return fail("You do not have access to this payment.", 403);

    return json({
      escrow: {
        id: escrow.id,
        reference: escrow.reference,
        type: escrow.type,
        state: escrow.state,
        itemAmountKobo: escrow.itemAmountKobo,
        cautionKobo: escrow.cautionKobo,
        feeKobo: escrow.feeKobo,
        totalKobo: escrow.totalKobo,
        payoutKobo: escrow.payoutKobo,
        feeSnapshot: escrow.feeSnapshot,
        periodStart: escrow.periodStart,
        periodEnd: escrow.periodEnd,
        createdAt: escrow.createdAt,
        confirmedAt: escrow.confirmedAt,
        releasedAt: escrow.releasedAt,
        refundedAt: escrow.refundedAt,
        // Who is who, from the viewer's point of view.
        iAmPayer: escrow.payerId === user.id,
        payer: escrow.payer,
        payee: escrow.payee,
        lodge: escrow.lodge,
        marketItem: escrow.marketItem,
        gig: escrow.gig,
        dispute: escrow.dispute,
        splitShares: escrow.splitShares,
        // Only the payer sees raw payment attempts.
        payments: escrow.payerId === user.id ? escrow.payments : [],
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
