/**
 * src/app/api/admin/disputes/route.ts
 * WHAT: The dispute queue for admins.
 * WHY : When two people disagree about money, an admin must see both sides, the
 *       evidence and the amount in one place before deciding.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

/**
 * GET /api/admin/disputes?status=OPEN
 * Admin only. Oldest first so nobody waits too long.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();

    const status = new URL(request.url).searchParams.get("status") ?? "OPEN";

    const disputes = await prisma.dispute.findMany({
      where: status === "ALL" ? {} : { status: status as "OPEN" },
      include: {
        escrow: {
          include: {
            payer: { select: { id: true, fullName: true, phone: true } },
            payee: { select: { id: true, fullName: true, phone: true } },
            lodge: { select: { id: true, title: true } },
            marketItem: { select: { id: true, title: true } },
            gig: { select: { id: true, title: true } },
          },
        },
        raisedBy: { select: { id: true, fullName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return json({ disputes });
  } catch (error) {
    return handleError(error);
  }
}
