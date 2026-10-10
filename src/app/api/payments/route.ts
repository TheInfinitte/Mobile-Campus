/**
 * src/app/api/payments/route.ts
 * WHAT: Creates an escrow deal AND a Flutterwave payment link in one step, and
 *       lists the signed-in user's payments.
 * WHY : This is the money door of the platform. It must:
 *       - refuse provisional (fresher) accounts,
 *       - calculate fees from FeeConfig (never hard-coded),
 *       - create the escrow row BEFORE the user pays so the webhook can find it,
 *       - never trust the client about the amount.
 *
 * THE AMOUNT IS SET HERE, SERVER-SIDE. The browser only receives a link.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, canPayAndMessage, upgradeMessage } from "@/lib/auth";
import { createEscrow, priceEscrow } from "@/lib/escrow";
import { initiatePayment } from "@/lib/flutterwave";
import { env } from "@/lib/env";
import { makeReference } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, createEscrowSchema } from "@/lib/validators";

/**
 * GET /api/payments
 * Returns the user's escrow transactions (as payer or payee).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const escrows = await prisma.escrowTransaction.findMany({
      where: { OR: [{ payerId: user.id }, { payeeId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        lodge: { select: { id: true, title: true, area: true } },
        marketItem: { select: { id: true, title: true, images: true } },
        gig: { select: { id: true, title: true, category: true } },
        payer: { select: { id: true, fullName: true, phone: true } },
        payee: { select: { id: true, fullName: true, phone: true } },
        dispute: { select: { id: true, status: true, reason: true } },
      },
    });

    return json({ escrows });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/payments
 * Body: { type: "RENT" | "PURCHASE" | "SERVICE", lodgeId? | marketItemId? | gigId?, months? }
 * Returns: { data: { escrowId, reference, totalKobo, paymentUrl, feeLines } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(createEscrowSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // RULE: provisional accounts cannot pay. This is the single most important
    // business rule on this endpoint.
    if (!canPayAndMessage(user)) {
      return fail(upgradeMessage(), 403);
    }

    const { type } = parsed.data;

    // ---------------------------------------------------------------------
    // Work out WHAT is being paid for, and to WHOM.
    // ---------------------------------------------------------------------
    let payeeId = "";
    let itemKobo = 0;
    let cautionKobo = 0;
    let lodgeId: string | null = null;
    let marketItemId: string | null = null;
    let gigId: string | null = null;
    let description = "";
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    if (type === "RENT") {
      if (!parsed.data.lodgeId) return fail("Choose a lodge to pay for.", 400);

      const lodge = await prisma.lodge.findUnique({ where: { id: parsed.data.lodgeId } });
      if (!lodge || lodge.status !== "ACTIVE") return fail("That listing is not available.", 404);
      if (lodge.availableRooms <= 0) return fail("That lodge is fully booked.", 409);
      if (lodge.landlordId === user.id) return fail("You cannot rent your own listing.", 400);

      // Monthly or annual: the user chooses with `months`.
      const months = parsed.data.months ?? 12;
      itemKobo = months >= 12 ? lodge.annualRentKobo : lodge.monthlyRentKobo * months;
      cautionKobo = lodge.cautionDepositKobo;
      payeeId = lodge.landlordId;
      lodgeId = lodge.id;
      description = `${months} month${months === 1 ? "" : "s"} rent - ${lodge.title}`;

      // The rental period starts today and runs for the paid months.
      periodStart = new Date();
      periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + months);
    } else if (type === "PURCHASE") {
      if (!parsed.data.marketItemId) return fail("Choose an item to buy.", 400);

      const item = await prisma.marketItem.findUnique({ where: { id: parsed.data.marketItemId } });
      if (!item || item.status !== "AVAILABLE") return fail("That item is no longer available.", 404);
      if (item.sellerId === user.id) return fail("You cannot buy your own item.", 400);

      itemKobo = item.priceKobo;
      payeeId = item.sellerId;
      marketItemId = item.id;
      description = item.title;
    } else {
      // SERVICE - paying a worker for a micro-gig.
      if (!parsed.data.gigId) return fail("Choose a task to pay for.", 400);

      const gig = await prisma.gig.findUnique({ where: { id: parsed.data.gigId } });
      if (!gig) return fail("That task was not found.", 404);
      if (!gig.workerId) return fail("Nobody has accepted this task yet.", 409);
      if (gig.posterId !== user.id) return fail("Only the person who posted the task can pay for it.", 403);
      if (gig.status === "COMPLETED" || gig.status === "CANCELLED") {
        return fail("This task is closed.", 409);
      }

      itemKobo = gig.budgetKobo;
      payeeId = gig.workerId;
      gigId = gig.id;
      description = gig.title;
    }

    // ---------------------------------------------------------------------
    // Price the deal using the live FeeConfig rows.
    // ---------------------------------------------------------------------
    const pricing = await priceEscrow({ type, itemKobo, cautionKobo });

    // ---------------------------------------------------------------------
    // Create the escrow row (PENDING_PAYMENT) and a Payment record so the
    // webhook has something to match on.
    // ---------------------------------------------------------------------
    const escrow = await createEscrow({
      type,
      payerId: user.id,
      payeeId,
      itemKobo,
      cautionKobo,
      lodgeId,
      marketItemId,
      gigId,
      periodStart,
      periodEnd,
    });

    const paymentReference = makeReference("MCP");

    await prisma.payment.create({
      data: {
        escrowId: escrow.id,
        userId: user.id,
        kind: "COLLECTION",
        status: "INITIATED",
        reference: paymentReference,
        amountKobo: pricing.totalKobo,
        feeKobo: pricing.payerFeeKobo,
      },
    });

    // Reserve the item so two buyers do not pay for the same thing.
    if (marketItemId) {
      await prisma.marketItem.update({ where: { id: marketItemId }, data: { status: "RESERVED" } });
    }

    // ---------------------------------------------------------------------
    // Ask Flutterwave for a payment link. The amount comes from OUR maths.
    // ---------------------------------------------------------------------
    const redirectUrl = `${env.app.url}/escrow/${escrow.id}?status=returning`;

    let paymentUrl = "";
    try {
      const result = await initiatePayment({
        txRef: paymentReference,
        amountKobo: pricing.totalKobo,
        email: user.email ?? `${user.phone}@mobilecampus.ng`,
        fullName: user.fullName,
        phone: user.phone,
        title: env.app.name,
        description,
        redirectUrl,
      });
      paymentUrl = result.link;
    } catch (error) {
      // If Flutterwave is unreachable we roll back the reservation so the item
      // is not stuck as RESERVED forever.
      if (marketItemId) {
        await prisma.marketItem.update({ where: { id: marketItemId }, data: { status: "AVAILABLE" } }).catch(() => null);
      }
      throw error;
    }

    // ---------------------------------------------------------------------
    // Tell the user what is happening.
    // ---------------------------------------------------------------------
    await notify({
      userId: user.id,
      title: "Payment started",
      body: `Complete your payment of ₦${(pricing.totalKobo / 100).toLocaleString("en-NG")} for ${description}.`,
      link: `/escrow/${escrow.id}`,
    });

    return json({
      escrowId: escrow.id,
      reference: escrow.reference,
      paymentReference,
      itemKobo: pricing.itemKobo,
      cautionKobo: pricing.cautionKobo,
      feeKobo: pricing.payerFeeKobo,
      totalKobo: pricing.totalKobo,
      payoutKobo: pricing.payoutKobo,
      feeLines: pricing.lines,
      paymentUrl,
      description,
    });
  } catch (error) {
    return handleError(error);
  }
}
