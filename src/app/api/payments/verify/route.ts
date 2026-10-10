/**
 * src/app/api/payments/verify/route.ts
 * WHAT: Confirms a payment by asking Flutterwave directly, then moves the escrow
 *       to HELD.
 * WHY : THIS IS THE ONLY PLACE A PAYMENT BECOMES "PAID". The client is never
 *       trusted. After Flutterwave redirects the user back to our site, we call
 *       /v3/transactions/verify_by_reference and only then mark it paid.
 *
 * We also check that the amount charged equals the amount we expected, so a
 * tampered checkout cannot underpay.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { applySuccessfulPayment } from "@/lib/payments";

/**
 * POST /api/payments/verify
 * Body: { reference } - the payment reference we generated.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Only the person who owns the payment may verify it.
    const user = await requireUser();
    const body = (await readJson(request)) as { reference?: string };

    if (!body.reference) return fail("No payment reference was provided.", 400);

    const payment = await prisma.payment.findUnique({ where: { reference: body.reference } });
    if (!payment) return fail("That payment was not found.", 404);
    if (payment.userId !== user.id) return fail("This payment does not belong to your account.", 403);

    const result = await applySuccessfulPayment(body.reference);

    if (!result.ok) {
      // 402 Payment Required is the honest status here.
      return fail(result.message, 402);
    }

    return json({ confirmed: true, escrowId: result.escrowId });
  } catch (error) {
    return handleError(error);
  }
}
