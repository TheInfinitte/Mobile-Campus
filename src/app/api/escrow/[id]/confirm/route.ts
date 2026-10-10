/**
 * src/app/api/escrow/[id]/confirm/route.ts
 * WHAT: The payer confirms they received what they paid for. This moves the
 *       escrow to CONFIRMED - the step before the money is released.
 * WHY : This single action is the whole point of escrow. The seller only gets
 *       paid after the buyer says the goods or the room are as promised.
 *
 * SAFETY:
 *   - Only the payer can confirm.
 *   - The state machine refuses illegal moves (a released payment cannot be
 *     confirmed again).
 *   - A dispute blocks confirmation, so a seller cannot be paid during a fight.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { moveEscrow } from "@/lib/escrow";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, confirmEscrowSchema } from "@/lib/validators";

type RouteContext = { params: { id: string } };

/**
 * POST /api/escrow/:id/confirm
 * Body: { escrowId, note? }
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(confirmEscrowSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const escrow = await prisma.escrowTransaction.findFirst({
      where: { OR: [{ id: context.params.id }, { reference: context.params.id }] },
      include: { payee: { select: { id: true, fullName: true } } },
    });

    if (!escrow) return fail("That payment was not found.", 404);

    // Only the person who paid may confirm.
    if (escrow.payerId !== user.id) {
      return fail("Only the person who paid can confirm this payment.", 403);
    }

    // A disputed payment is frozen until an admin decides.
    if (escrow.state === "DISPUTED") {
      return fail("This payment is in dispute. Wait for our team to resolve it.", 409);
    }

    // Only HELD money can be confirmed.
    if (escrow.state !== "HELD") {
      return fail("This payment is not waiting for confirmation.", 409);
    }

    // Move HELD -> CONFIRMED. Throws a 409 if that move is illegal.
    await moveEscrow(escrow.id, "CONFIRMED");

    // Mark the item as sold / the room as taken.
    if (escrow.marketItemId) {
      await prisma.marketItem.update({ where: { id: escrow.marketItemId }, data: { status: "SOLD" } }).catch(() => null);
    }
    if (escrow.gigId) {
      await prisma.gig.update({ where: { id: escrow.gigId }, data: { status: "COMPLETED" } }).catch(() => null);
    }

    await notify({
      userId: escrow.payeeId,
      title: "Buyer confirmed ✅",
      body: `${user.fullName.split(" ")[0]} confirmed "${escrow.reference}". Your money will be released to your account shortly.`,
      link: "/escrow",
      sms: true,
      smsBody: `Mobile Campus: the buyer confirmed ${escrow.reference}. Your payout is being processed.`,
    });

    return json({ state: "CONFIRMED" });
  } catch (error) {
    return handleError(error);
  }
}
