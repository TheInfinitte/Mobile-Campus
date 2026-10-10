/**
 * src/lib/flutterwave.ts
 * WHAT: All Flutterwave API calls in one place: creating a payment, verifying a
 *       transaction, verifying webhooks, and sending transfers (payouts).
 * WHY : Money code must live in exactly one file so it can be reviewed, tested
 *       and audited. Nothing in the browser is ever trusted about money.
 *
 * THE GOLDEN RULES
 *   1. NEVER mark a payment as paid from the client. The client only opens the
 *      Flutterwave checkout page. Our server confirms the payment afterwards by
 *      calling /v3/transactions/:id/verify AND by checking the webhook.
 *   2. Webhooks are verified with the `verif-hash` header. If the header does
 *      not match FLW_WEBHOOK_HASH we reject the request immediately.
 *   3. Some endpoints need an "encrypted payload": the JSON body is encrypted
 *      with FLW_ENCRYPTION_KEY and sent as a `client` query parameter.
 */
import crypto from "crypto";
import { env } from "./env";
import { ApiError } from "./auth";
import { toNaira } from "./money";

/** Base URL for the Flutterwave v3 API. */
const FLW_BASE = "https://api.flutterwave.com/v3";

// -------------------------------------------------------------------------
// PAYLOAD ENCRYPTION
// -------------------------------------------------------------------------

/**
 * buildEncryptionKey
 * WHAT: Turns the Flutterwave encryption key into a valid 3DES key.
 * WHY : Flutterwave's v3 encryption uses 3DES-ECB and expects a key that is
 *       exactly 24 characters: the first 12 characters of your key plus your
 *       key with the first and last 4 characters removed.
 */
function buildEncryptionKey(): string {
  const key = env.flutterwave.encryptionKey;
  if (!key) throw new ApiError(500, "FLW_ENCRYPTION_KEY is not configured.");
  // "md5 of first 12 chars" + "key without first/last 4 chars" = 24 chars total.
  const md5 = crypto.createHash("md5").update(key).digest("hex");
  const middle = key.replace(key.slice(-4), "").slice(4);
  return (md5.slice(0, 12) + middle).slice(0, 24);
}

/**
 * encryptPayload
 * WHAT: Encrypts a JSON object into the string Flutterwave expects in `client`.
 * WHY : Required by the standard payment and transfer endpoints.
 */
export function encryptPayload(payload: Record<string, unknown>): string {
  const cipher = crypto.createCipheriv("des-ede3", buildEncryptionKey(), null);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return encrypted.toString("base64");
}

// -------------------------------------------------------------------------
// LOW-LEVEL REQUEST HELPER
// -------------------------------------------------------------------------

/**
 * flwFetch
 * WHAT: A thin wrapper around fetch that adds auth headers and error handling.
 * WHY : Every Flutterwave call needs the same Bearer token and the same way of
 *       turning a bad response into a clear error.
 */
async function flwFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!env.flutterwave.secretKey) {
    throw new ApiError(500, "FLW_SECRET_KEY is not configured. Add it to your .env file.");
  }

  const response = await fetch(`${FLW_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env.flutterwave.secretKey}`,
      "Content-Type": "application/json",
    },
    // Send the body only when there is one.
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    // Never cache money calls.
    cache: "no-store",
  });

  // Read the text first so we can include it in the error message.
  const text = await response.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new ApiError(502, "Flutterwave returned a response we could not read.");
  }

  if (!response.ok) {
    const message = (data as { message?: string })?.message ?? `Flutterwave request failed (${response.status})`;
    throw new ApiError(502, message);
  }

  return data;
}

// -------------------------------------------------------------------------
// PAYMENTS (COLLECTIONS)
// -------------------------------------------------------------------------

/** What Flutterwave returns after creating a payment. */
type InitiateResponse = {
  status: string;
  message: string;
  data: { link: string };
};

/**
 * initiatePayment
 * WHAT: Creates a Flutterwave payment link for an amount and returns the URL
 *       the user's browser should be redirected to.
 * WHY : We use the server-side "create payment" endpoint (not the inline JS
 *       library) so the amount and currency are set by our server, never by
 *       the browser. A user cannot tamper with the price.
 *
 * `txRef` is our own unique reference. Flutterwave sends it back to us in the
 * webhook, which is how we know which escrow was paid.
 */
export async function initiatePayment(input: {
  txRef: string;
  amountKobo: number;
  email: string;
  fullName: string;
  phone?: string;
  title?: string;
  description?: string;
  redirectUrl: string;
}): Promise<{ link: string }> {
  const amount = toNaira(input.amountKobo);
  if (amount <= 0) throw new ApiError(400, "The payment amount must be greater than zero.");

  const payload = {
    tx_ref: input.txRef,
    amount,
    currency: "NGN",
    redirect_url: input.redirectUrl,
    payment_options: "card,banktransfer,ussd", // The ways students actually pay.
    customer: {
      email: input.email,
      name: input.fullName,
      phonenumber: input.phone ?? "",
    },
    customizations: {
      title: input.title ?? env.app.name,
      description: input.description ?? "Payment protected by Mobile Campus escrow",
      logo: "",
    },
    meta: {
      // Anything we want echoed back in the webhook.
      source: "mobile-campus",
      environment: env.flutterwave.testMode ? "test" : "live",
    },
  };

  // This endpoint takes an encrypted payload in a `client` query parameter.
  const client = encryptPayload(payload as unknown as Record<string, unknown>);
  const response = await flwFetch<InitiateResponse>(`/payments?client=${encodeURIComponent(client)}`);

  if (!response?.data?.link) {
    throw new ApiError(502, "Flutterwave did not return a payment link.");
  }
  return { link: response.data.link };
}

/** The shape of Flutterwave's transaction verify response that we care about. */
export type VerifiedTransaction = {
  id: number;
  tx_ref: string;
  flw_ref: string;
  status: string;         // "successful", "failed", "pending"...
  amount: number;         // In naira.
  currency: string;
  charged_amount: number;
  customer?: { email?: string; name?: string; phone_number?: string };
  created_at?: string;
};

/**
 * verifyTransaction
 * WHAT: Asks Flutterwave directly whether a transaction really succeeded.
 * WHY : This is the second line of defence. Webhooks can be delayed or missed,
 *       so before we release money we always ask Flutterwave to confirm.
 *
 * Accepts either the numeric Flutterwave id or our own tx_ref.
 */
export async function verifyTransaction(idOrRef: string | number): Promise<VerifiedTransaction | null> {
  const path = typeof idOrRef === "number"
    ? `/transactions/${idOrRef}/verify`
    : `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(idOrRef)}`;

  try {
    const response = await flwFetch<{ status: string; data: VerifiedTransaction }>(path);
    return response?.data ?? null;
  } catch {
    // A verification failure must not be treated as a successful payment.
    return null;
  }
}

/**
 * isTransactionSuccessful
 * WHAT: The only place that decides a Flutterwave transaction counts as paid.
 * WHY : Status strings vary slightly between endpoints. Centralising the check
 *       stops one route from being stricter than another.
 */
export function isTransactionSuccessful(tx: VerifiedTransaction | null): boolean {
  return tx?.status?.toLowerCase() === "successful";
}

/**
 * amountMatches
 * WHAT: Confirms Flutterwave charged the exact amount we expected.
 * WHY : Protects against a manipulated checkout or a partial payment being
 *       treated as a full one. We compare in kobo to avoid float issues.
 */
export function amountMatches(tx: VerifiedTransaction | null, expectedKobo: number): boolean {
  if (!tx) return false;
  const chargedKobo = Math.round((tx.charged_amount || tx.amount || 0) * 100);
  return chargedKobo >= expectedKobo;
}

// -------------------------------------------------------------------------
// WEBHOOKS
// -------------------------------------------------------------------------

/**
 * verifyWebhookHash
 * WHAT: Checks the `verif-hash` request header against FLW_WEBHOOK_HASH.
 * WHY : This proves the request really came from Flutterwave. Without it,
 *       anyone could POST a fake "payment successful" message to our server.
 */
export function verifyWebhookHash(headerValue: string | null): boolean {
  const expected = env.flutterwave.webhookHash;
  if (!expected) {
    // If no hash is configured we must fail closed, not open.
    console.error("[flutterwave] FLW_WEBHOOK_HASH is not configured - rejecting webhook.");
    return false;
  }
  if (!headerValue) return false;

  // Compare as buffers so the length check cannot leak information.
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// -------------------------------------------------------------------------
// TRANSFERS (PAYOUTS TO SELLERS AND LANDLORDS)
// -------------------------------------------------------------------------

/** What Flutterwave returns after creating a transfer. */
type TransferResponse = {
  status: string;
  message: string;
  data: {
    id: number;
    reference: string;
    status: string; // "NEW", "COMPLETED", "FAILED"...
  };
};

/**
 * createTransfer
 * WHAT: Sends money from the Mobile Campus wallet to a seller or landlord.
 * WHY : This is the "release" step of escrow. Money only moves after the buyer
 *       has confirmed they received what they paid for.
 */
export async function createTransfer(input: {
  reference: string;
  accountBank: string;   // Flutterwave bank code, e.g. "044" for Access Bank.
  accountNumber: string;
  amountKobo: number;
  narration: string;
}): Promise<{ id: number; reference: string; status: string }> {
  const amount = toNaira(input.amountKobo);
  if (amount <= 0) throw new ApiError(400, "Transfer amount must be greater than zero.");

  const response = await flwFetch<TransferResponse>("/transfers", {
    method: "POST",
    body: {
      reference: input.reference,
      account_bank: input.accountBank,
      account_number: input.accountNumber,
      amount,
      currency: "NGN",
      narration: input.narration.slice(0, 100), // Flutterwave limits narration length.
    },
  });

  if (!response?.data) {
    throw new ApiError(502, "Flutterwave did not create the transfer.");
  }

  return {
    id: response.data.id,
    reference: response.data.reference ?? input.reference,
    status: response.data.status ?? "NEW",
  };
}

/**
 * verifyTransfer
 * WHAT: Checks whether a payout actually completed.
 * WHY : Transfers are asynchronous. We confirm before telling a landlord their
 *       money has landed.
 */
export async function verifyTransfer(id: number): Promise<{ status: string } | null> {
  try {
    const response = await flwFetch<{ data: { status: string } }>(`/transfers/${id}`);
    return response?.data ?? null;
  } catch {
    return null;
  }
}
