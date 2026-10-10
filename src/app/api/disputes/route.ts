/**
 * src/app/api/disputes/route.ts
 * WHAT: Opens a dispute on a held payment, and lists the user's disputes.
 * WHY : Disputes are the safety valve of escrow. Without a clear, calm way to
 *       complain, students would simply stop paying through the platform.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { moveEscrow } from "@/lib/escrow";
import { notify } from "@/lib/notifications";
import { disputeMessage } from "@/lib/termii";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, disputeSchema } from "@/lib/validators";

/**
 * GET /api/disputes
 * Returns the disputes the user is involved in.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const disputes = await prisma.dispute.findMany({
      where: {
        escrow: { OR: [{ payerId: user.id }, { payeeId: user.id }] },
      },
      include: {
        escrow: {
          select: {
            id: true,
            reference: true,
            state: true,
            totalKobo: true,
            payoutKobo: true,
            payer: { select: { id: true, fullName: true } },
            payee: { select: { id: true, fullName: true } },
          },
        },
        raisedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return json({ disputes });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/disputes
 * Body: { escrowId, reason, details, evidenceUrls }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(disputeSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const escrow = await prisma.escrowTransaction.findFirst({
      where: { OR: [{ id: parsed.data.escrowId }, { reference: parsed.data.escrowId }] },
      include: { payer: { select: { id: true, fullName: true } }, payee: { select: { id: true, fullName: true, phone: true } } },
    });

    if (!escrow) return fail("That payment was not found.", 404);

    // Either side of the deal may dispute.
    const involved = escrow.payerId === user.id || escrow.payeeId === user.id;
    if (!involved) return fail("You are not part of this payment.", 403);

    // Only money that is still held (or confirmed but not yet released) can be
    // disputed. Once it is released the money has left our control.
    if (escrow.state !== "HELD" && escrow.state !== "CONFIRMED") {
      return fail("This payment can no longer be disputed. Contact support if you need help.", 409);
    }

    // One dispute per escrow (also enforced by a unique index).
    const existing = await prisma.dispute.findUnique({ where: { escrowId: escrow.id } });
    if (existing) return fail("A dispute has already been opened on this payment.", 409);

    const dispute = await prisma.dispute.create({
      data: {
        escrowId: escrow.id,
        raisedById: user.id,
        reason: parsed.data.reason,
        details: parsed.data.details,
        evidenceUrls: parsed.data.evidenceUrls,
        status: "OPEN",
      },
    });

    // Freeze the money.
    await moveEscrow(escrow.id, "DISPUTED");

    // Tell the other party immediately - they must not think we have vanished.
    const otherUserId = escrow.payerId === user.id ? escrow.payeeId : escrow.payerId;
    await notify({
      userId: otherUserId,
      title: "A dispute was opened",
      body: `${user.fullName.split(" ")[0]} raised a dispute on ${escrow.reference}: ${parsed.data.reason}. Our team will contact you within 24 hours.`,
      link: "/escrow",
      sms: true,
      smsBody: disputeMessage("Hello", escrow.reference),
    });

    // Tell the person who raised it what happens next.
    await notify({
      userId: user.id,
      title: "Dispute received",
      body: "The money is frozen and an administrator will review your evidence within 24 hours.",
      link: "/escrow",
    });

    return json({ id: dispute.id, state: "DISPUTED" }, 201);
  } catch (error) {
    return handleError(error);
  }
}
