/**
 * src/lib/payments.ts
 * WHAT: The one routine that turns a Flutterwave reference into a confirmed
 *       payment and moves the escrow to HELD.
 * WHY : Two entry points confirm money - the checkout redirect (POST
 *       /api/payments/verify) and the Flutterwave webhook. They must behave
 *       identically, so the logic lives here and both call it.
 *
 *       It used to live inside the route file and be imported from there,
 *       which Next.js rejects: an App Router route file may only export HTTP
 *       handlers and route config, so the build failed with "not a valid Route
 *       export field". Moving it to a plain module fixes that and keeps the
 *       single-source-of-truth property.
 *
 * It is idempotent: confirming the same payment twice changes nothing the
 * second time, which matters because Flutterwave retries webhooks.
 */
import { prisma } from "@/lib/prisma";
import { verifyTransaction, isTransactionSuccessful, amountMatches } from "@/lib/flutterwave";
import { moveEscrow } from "@/lib/escrow";
import { notify } from "@/lib/notifications";

/**
 * applySuccessfulPayment
 * WHAT: The shared "this payment is real" routine, used by BOTH this route and
 *       the webhook handler.
 * WHY : Two entry points must behave identically. Keeping the logic in one
 *       exported function means a fix in one place fixes both.
 *
 * It is idempotent: calling it twice for the same payment changes nothing the
 * second time.
 */
export async function applySuccessfulPayment(paymentReference: string): Promise<{
  ok: boolean;
  message: string;
  escrowId?: string;
}> {
  // 1. Ask Flutterwave whether this transaction really succeeded.
  const transaction = await verifyTransaction(paymentReference);
  if (!isTransactionSuccessful(transaction)) {
    return { ok: false, message: "Flutterwave has not confirmed this payment yet." };
  }

  // 2. Find our payment record by the reference we sent to Flutterwave.
  const payment = await prisma.payment.findUnique({
    where: { reference: paymentReference },
    include: { escrow: true },
  });
  if (!payment) {
    return { ok: false, message: "We could not match that payment to a booking." };
  }

  // 3. Already processed? Do nothing (this makes webhooks safe to retry).
  if (payment.status === "SUCCESSFUL") {
    return { ok: true, message: "This payment was already confirmed.", escrowId: payment.escrowId ?? undefined };
  }

  // 4. The amount must match exactly what we asked for.
  if (!amountMatches(transaction, payment.amountKobo)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", providerResponse: `Amount mismatch: ${transaction?.charged_amount}` },
    });
    return { ok: false, message: "The amount paid does not match the amount due." };
  }

  // 5. Record the successful payment.
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCESSFUL",
      method: "FLUTTERWAVE_CARD",
      flwTransactionId: String(transaction?.id ?? ""),
      flwReference: transaction?.flw_ref ?? "",
      providerResponse: JSON.stringify({ status: transaction?.status, charged: transaction?.charged_amount }),
      paidAt: new Date(),
    },
  });

  // 6. Move the escrow from PENDING_PAYMENT to HELD.
  if (payment.escrow && payment.escrow.state === "PENDING_PAYMENT") {
    await moveEscrow(payment.escrow.id, "HELD");

    // Decrement availability on a rented lodge.
    if (payment.escrow.lodgeId) {
      await prisma.lodge
        .update({
          where: { id: payment.escrow.lodgeId },
          data: { availableRooms: { decrement: 1 } },
        })
        .catch(() => null); // Never let a counter bug block a payment.
    }

    // 7. Notify both sides - SMS included, because this is money.
    await notify({
      userId: payment.escrow.payerId,
      title: "Payment held safely 🔒",
      body: `Your ₦${(payment.escrow.totalKobo / 100).toLocaleString("en-NG")} is in escrow (${payment.escrow.reference}). Confirm when you are satisfied and we will release it.`,
      link: `/escrow/${payment.escrow.id}`,
      sms: true,
      // A short SMS is cheaper and easier to read than the full in-app body.
      smsBody: `Mobile Campus: your payment of ₦${(payment.escrow.totalKobo / 100).toLocaleString(
        "en-NG"
      )} is held in escrow (ref ${payment.escrow.reference}). Confirm delivery to release it.`,
    });

    await notify({
      userId: payment.escrow.payeeId,
      title: "You have a secured payment",
      body: `A buyer has paid ₦${(payment.escrow.totalKobo / 100).toLocaleString("en-NG")} (${payment.escrow.reference}). It is released to you after they confirm.`,
      link: "/escrow",
      sms: true,
      smsBody: `Mobile Campus: a secured payment of ₦${(payment.escrow.totalKobo / 100).toLocaleString("en-NG")} is waiting for you (ref ${payment.escrow.reference}).`,
    });
  }

  return { ok: true, message: "Payment confirmed.", escrowId: payment.escrowId ?? undefined };
}
