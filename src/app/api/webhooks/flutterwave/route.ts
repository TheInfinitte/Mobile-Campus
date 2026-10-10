/**
 * src/app/api/webhooks/flutterwave/route.ts
 * WHAT: Receives Flutterwave's server-to-server payment notifications.
 * WHY : Webhooks are the reliable channel - the user's browser can be closed
 *       before the redirect happens, but Flutterwave will still tell us.
 *
 * SECURITY (non-negotiable):
 *   1. The `verif-hash` header must match FLW_WEBHOOK_HASH exactly.
 *   2. Even after the header checks out, we call /v3/transactions/:id/verify
 *      before marking anything paid. A leaked webhook hash alone is not enough
 *      to fake a payment.
 *   3. The handler is idempotent - Flutterwave retries webhooks, so processing
 *      the same event twice must be harmless.
 *   4. We always respond 200 quickly so Flutterwave does not keep retrying.
 */
import { NextResponse } from "next/server";
import { verifyWebhookHash } from "@/lib/flutterwave";
import { applySuccessfulPayment } from "@/lib/payments";

/**
 * POST /api/webhooks/flutterwave
 * Flutterwave sends the transaction details here after a payment attempt.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // 1. Verify the webhook signature FIRST, before reading the body.
  const hash = request.headers.get("verif-hash");
  if (!verifyWebhookHash(hash)) {
    console.warn("[flutterwave webhook] rejected: bad or missing verif-hash");
    // 401 tells Flutterwave the request was not accepted.
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  // 2. Read the event.
  let event: {
    event?: string;
    data?: {
      id?: number;
      tx_ref?: string;
      status?: string;
      amount?: number;
      currency?: string;
    };
  };

  try {
    event = (await request.json()) as typeof event;
  } catch {
    // A malformed body is not worth retrying.
    return NextResponse.json({ status: "error", message: "Bad request" }, { status: 400 });
  }

  const eventName = event.event ?? "";
  const data = event.data ?? {};

  // 3. We only act on payment events. Transfers have their own event name and
  //    are handled by the escrow release flow.
  if (eventName === "charge.completed" && data.tx_ref) {
    try {
      // Re-verify with Flutterwave and update our records.
      await applySuccessfulPayment(data.tx_ref);
    } catch (error) {
      // Log it, but still answer 200 so Flutterwave stops retrying a problem we
      // have already recorded.
      console.error("[flutterwave webhook] processing failed:", error);
    }
  }

  // 4. Always acknowledge.
  return NextResponse.json({ status: "success" }, { status: 200 });
}

/**
 * GET /api/webhooks/flutterwave
 * WHAT: A tiny health check.
 * WHY : Lets you confirm the webhook URL is reachable from the internet without
 *       sending a real payment.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok", endpoint: "flutterwave-webhook" });
}
