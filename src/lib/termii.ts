/**
 * src/lib/termii.ts
 * WHAT: Sends SMS messages through Termii (a Nigerian SMS provider) and
 *       provides ready-made message templates for every notification type.
 * WHY : Students in Nigeria respond to SMS far more reliably than email, and
 *       OTP delivery must work on any phone - not just smartphones.
 *
 * SAFETY: If TERMII_API_KEY is not configured we log the message instead of
 * failing, so local development works without an SMS account.
 */
import { env } from "./env";
import { normalisePhone } from "./otp";

/** Termii's send endpoint. */
const TERMII_URL = "https://api.ng.termii.com/api/sms/send";

/** Result of an SMS attempt. */
export type SmsResult = {
  sent: boolean;
  messageId?: string;
  error?: string;
};

/**
 * sendSms
 * WHAT: Sends one SMS to one Nigerian number.
 * WHY : One function handles auth, formatting and error handling for every
 *       message the platform sends.
 *
 * Never throws - a failed SMS must not break a payment or a sign-up. The
 * in-app notification is always written too, so the user still sees it.
 */
export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  // Convert 08012345678 into the international format Termii expects.
  const local = normalisePhone(phone);
  const international = local.startsWith("0") ? `234${local.slice(1)}` : local;

  // Development mode: print to the console so you can still test flows.
  if (!env.termii.apiKey) {
    console.log(`[SMS DEV] -> ${international}: ${message}`);
    return { sent: true, messageId: "dev-only" };
  }

  try {
    const response = await fetch(TERMII_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.termii.apiKey,
        to: international,
        from: env.termii.senderId, // Your registered Termii sender ID.
        sms: message,
        type: "plain",
        channel: "generic", // Tries every available route for best delivery.
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as { message_id?: string; balance?: number; message?: string };

    if (!response.ok) {
      return { sent: false, error: data.message ?? `Termii error ${response.status}` };
    }
    return { sent: true, messageId: data.message_id };
  } catch (error) {
    // Network failure - report it but do not crash the caller.
    return { sent: false, error: error instanceof Error ? error.message : "Unknown SMS error" };
  }
}

// -------------------------------------------------------------------------
// MESSAGE TEMPLATES
// -------------------------------------------------------------------------
// Every SMS the platform sends is written here so the wording is consistent
// and short (SMS is charged per 160 characters).

/** OTP code for signing up or signing in. */
export const otpMessage = (code: string): string =>
  `Your ${env.app.name} code is ${code}. It expires in 10 minutes. Do not share it with anyone.`;

/** Verification outcome. */
export const verificationMessage = (name: string, approved: boolean, note?: string): string =>
  approved
    ? `Hello ${name}, your verification was APPROVED. You now have full access to ${env.app.name}.`
    : `Hello ${name}, your verification was not approved${note ? `: ${note}` : ""}. You can upload a clearer document in the app.`;

/** A student has requested to view a lodge. */
export const viewingRequestMessage = (caretakerName: string, lodgeTitle: string, studentName: string, date: string): string =>
  `Hello ${caretakerName}, ${studentName} wants to view "${lodgeTitle}" on ${date}. Confirm in the ${env.app.name} app.`;

/** Payment held in escrow. */
export const escrowHeldMessage = (name: string, amount: string, reference: string): string =>
  `${name}, your payment of ${amount} is held safely in escrow (ref ${reference}). It is released only after you confirm.`;

/** Money released to a seller or landlord. */
export const escrowReleasedMessage = (name: string, amount: string, reference: string): string =>
  `${name}, ${amount} has been released to your account for ${reference}. Thank you for using ${env.app.name}.`;

/** A dispute was opened. */
export const disputeMessage = (name: string, reference: string): string =>
  `${name}, a dispute was opened on payment ${reference}. Our team is reviewing it and will contact you within 24 hours.`;

/** A viewing request was confirmed by the caretaker. */
export const viewingConfirmedMessage = (studentName: string, lodgeTitle: string, date: string): string =>
  `${studentName}, your viewing of "${lodgeTitle}" is confirmed for ${date}. Meet the caretaker at the gate.`;
