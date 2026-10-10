/**
 * src/lib/otp.ts
 * WHAT: Generates, stores and verifies 6-digit SMS one-time passwords.
 * WHY : Phone OTP is how Nigerian users prove they own the number they signed
 *       up with. We must make the codes short-lived, hashed, and limited in
 *       how many times they can be guessed.
 *
 * SECURITY RULES:
 *   - The code is stored as a SHA-256 hash, never in plain text.
 *   - Codes expire after 10 minutes.
 *   - A code is deleted after 5 wrong attempts.
 *   - A phone number can only request a new code every 60 seconds,
 *     and at most 5 codes per hour.
 */
import crypto from "crypto";
import { prisma } from "./prisma";
import { rateLimit, resetRateLimit, peekRateLimit, rateLimitRemaining } from "./rate-limit";
import { ApiError } from "./auth";

/** How long a code stays valid. */
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
/** How many wrong guesses are allowed. */
const MAX_ATTEMPTS = 5;
/** Minimum seconds between sending two codes to the same number. */
const RESEND_COOLDOWN_MS = 60 * 1000;
/** Maximum codes a number may request in an hour. */
const MAX_PER_HOUR = 5;

// We keep codes in memory (they are short-lived anyway) plus a mirror of the
// attempt counter on the User row so we can see abuse in the database.
type OtpRecord = {
  hash: string;
  expiresAt: number;
  attempts: number;
};

const otpStore = new Map<string, OtpRecord>();

/**
 * normalisePhone
 * WHAT: Cleans a phone number into the local Nigerian format "08012345678".
 * WHY : Users type +234 801 234 5678, 801-234-5678, 08012345678 and so on.
 *       One format prevents duplicate accounts and failed OTP delivery.
 */
export function normalisePhone(input: string): string {
  // Remove every character that is not a digit.
  const digits = input.replace(/\D/g, "");

  // +234... or 234... -> 0...
  if (digits.startsWith("234") && digits.length === 13) return `0${digits.slice(3)}`;
  if (digits.startsWith("0") && digits.length === 11) return digits;
  if (digits.length === 10) return `0${digits}`; // Missing the leading zero.

  // Return what we have; validation elsewhere will reject bad lengths.
  return digits;
}

/**
 * isValidNigerianPhone
 * WHAT: Checks the number looks like a real Nigerian mobile number.
 * WHY : Stops us paying Termii to send an SMS to an impossible number.
 */
export function isValidNigerianPhone(input: string): boolean {
  return /^0[789][01]\d{8}$/.test(normalisePhone(input));
}

/** Hashes a code so the plain digits are never stored. */
function hashCode(code: string, phone: string): string {
  // Mixing the phone number in means the same code on two numbers
  // produces different hashes.
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

/**
 * createOtp
 * WHAT: Generates a 6-digit code, stores its hash, and returns the plain code.
 * WHY : The caller sends the plain code by SMS once, then throws it away.
 *       Only the hash stays on the server.
 *
 * Throws 429 if the number is asking for codes too often.
 */
export function createOtp(phone: string): string {
  const clean = normalisePhone(phone);

  // Rule 1: no more than one code per minute per number.
  const cooldown = rateLimit(`otp:cooldown:${clean}`, 1, RESEND_COOLDOWN_MS);
  if (!cooldown.allowed) {
    throw new ApiError(429, `Please wait ${Math.ceil(cooldown.retryAfterMs / 1000)} seconds before requesting another code.`);
  }

  // Rule 2: no more than five codes per hour per number.
  const hourly = rateLimit(`otp:hourly:${clean}`, MAX_PER_HOUR, 60 * 60 * 1000);
  if (!hourly.allowed) {
    throw new ApiError(429, "Too many codes requested. Please try again in an hour.");
  }

  // crypto.randomInt is cryptographically secure (unlike Math.random).
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  otpStore.set(clean, {
    hash: hashCode(code, clean),
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  });

  return code;
}

/**
 * verifyOtp
 * WHAT: Checks the code the user typed. Deletes the code on success so it
 *       cannot be reused.
 * WHY : This is the moment we trust that the person owns this phone number.
 *
 * Throws 400 for a wrong/expired code and 429 after too many attempts.
 */
export function verifyOtp(phone: string, code: string): void {
  const clean = normalisePhone(phone);
  const record = otpStore.get(clean);

  if (!record) {
    throw new ApiError(400, "That code is not valid. Please request a new one.");
  }

  // Expired code.
  if (record.expiresAt < Date.now()) {
    otpStore.delete(clean);
    throw new ApiError(400, "That code has expired. Please request a new one.");
  }

  // Too many wrong guesses - burn the code.
  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(clean);
    throw new ApiError(429, "Too many wrong attempts. Please request a new code.");
  }

  // Compare hashes, not plain codes.
  if (record.hash !== hashCode(code.trim(), clean)) {
    record.attempts += 1;
    const left = MAX_ATTEMPTS - record.attempts;
    throw new ApiError(400, `Incorrect code. You have ${left} attempt${left === 1 ? "" : "s"} left.`);
  }

  // Success: remove the code and clear the attempt counters.
  otpStore.delete(clean);
  resetRateLimit(`otp:attempts:${clean}`);
}

/**
 * markOtpAbuse
 * WHAT: Writes the OTP request time onto the User row.
 * WHY : Gives admins a visible signal that a number is being hammered, and
 *       survives a server restart (unlike the in-memory limiter).
 */
export async function markOtpAbuse(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastOtpAt: new Date(), otpAttempts: { increment: 1 } },
  });
}

/**
 * timeUntilNextOtp
 * WHAT: Seconds until the user may request another code (0 if they can now).
 * WHY : The sign-up screen shows a countdown instead of a confusing error.
 */
export function timeUntilNextOtp(phone: string): number {
  const clean = normalisePhone(phone);

  // Ask the rate limiter how long is left on this number's 60-second resend
  // cooldown. peekRateLimit does not consume a request, so merely checking
  // never costs the user one of their five codes per hour.
  const cooldownMs = peekRateLimit(`otp:cooldown:${clean}`);

  // Also respect the hourly cap: if they have used all MAX_PER_HOUR codes, the
  // hourly window may be the longer wait, and that is the honest answer to give
  // them. rateLimitRemaining needs the limit because a key with no active window
  // has no stored count to read.
  const hourlyMs = peekRateLimit(`otp:hourly:${clean}`);
  const hourlyExhausted = rateLimitRemaining(`otp:hourly:${clean}`, MAX_PER_HOUR) <= 0;

  const waitMs = hourlyExhausted ? Math.max(cooldownMs, hourlyMs) : cooldownMs;
  return Math.ceil(waitMs / 1000);
}
