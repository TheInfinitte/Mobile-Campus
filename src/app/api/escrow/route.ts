/**
 * src/app/api/escrow/route.ts
 * WHAT: Lists the signed-in user's escrow transactions.
 * WHY : "My payments" is where a student tracks what they have paid, what is held
 *       and what has been released. It is also where a landlord watches for
 *       incoming money.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

/**
 * GET /api/escrow?role=payer|payee|all
 * Returns escrow deals, newest first.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const role = new URL(request.url).searchParams.get("role") ?? "all";

    // Build the filter based on which side the user wants to see.
    const where =
      role === "payer"
        ? { payerId: user.id }
        : role === "payee"
          ? { payeeId: user.id }
          : { OR: [{ payerId: user.id }, { payeeId: user.id }] };

    const escrows = await prisma.escrowTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        lodge: { select: { id: true, title: true, area: true } },
        marketItem: { select: { id: true, title: true, images: true, category: true } },
        gig: { select: { id: true, title: true, category: true } },
        payer: { select: { id: true, fullName: true, phone: true } },
        payee: { select: { id: true, fullName: true, phone: true } },
        dispute: { select: { id: true, status: true, reason: true } },
        // Include split shares so a group rental shows who has paid.
        splitShares: { include: { user: { select: { id: true, fullName: true } } } },
        payments: { select: { id: true, reference: true, status: true, amountKobo: true, paidAt: true } },
      },
    });

    // Totals for the summary cards at the top of the screen.
    const totals = escrows.reduce(
      (acc, escrow) => {
        if (escrow.payerId === user.id) {
          if (escrow.state === "HELD" || escrow.state === "CONFIRMED") acc.heldKobo += escrow.totalKobo;
          if (escrow.state === "RELEASED") acc.paidKobo += escrow.totalKobo;
        } else {
          if (escrow.state === "RELEASED") acc.receivedKobo += escrow.payoutKobo;
        }
        return acc;
      },
      { heldKobo: 0, paidKobo: 0, receivedKobo: 0 }
    );

    return json({ escrows, totals });
  } catch (error) {
    return handleError(error);
  }
}
