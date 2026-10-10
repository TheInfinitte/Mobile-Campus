/**
 * src/lib/session.ts
 * WHAT: The Edge-safe half of our session handling - it knows how to READ and
 *       VERIFY the login cookie, and nothing else.
 * WHY : Next.js middleware runs in the Edge runtime, which has no database
 *       driver. `src/lib/auth.ts` imports Prisma, so importing it from
 *       middleware crashes the build. This file imports nothing Node-specific,
 *       so both middleware (Edge) and API routes (Node) share one copy of the
 *       cookie logic instead of two that could drift apart.
 *
 * COOKIE FORMAT: "userId.expiresAt.signature"
 *   - userId    the database id of the logged-in user
 *   - expiresAt when the session dies, as milliseconds since 1970
 *   - signature HMAC-SHA256 of "userId.expiresAt" using SESSION_SECRET
 *
 * The signature is the important part. Anyone can read a cookie, so without it
 * a user could edit the userId and log in as somebody else.
 *
 * WHY WebCrypto AND NOT node:crypto:
 *   The first version of this file imported `crypto` from Node. The build then
 *   warned that a Node module was being loaded into the Edge runtime, which is
 *   not supported. WebCrypto (`crypto.subtle`) is available in BOTH runtimes,
 *   so using it here keeps middleware working and gives API routes the exact
 *   same behaviour. The one cost is that WebCrypto is asynchronous, so the
 *   verify and build functions return Promises.
 */

/** Name of the session cookie. Must match the one auth.ts writes. */
export const SESSION_COOKIE = "mc_session";

/** How long a login lasts: 30 days in milliseconds. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * sessionSecret
 * WHAT: The secret key used to sign and verify cookies.
 * WHY : Read from the environment here rather than via `src/lib/env.ts`, which
 *       pulls Prisma in through its imports and would break the Edge build.
 *       The default matches env.ts exactly - if the two ever drifted, a cookie
 *       signed by one would fail verification in the other.
 */
const sessionSecret =
  process.env.SESSION_SECRET || "dev-only-session-secret-change-me-32";

/**
 * toHex
 * WHAT: Turns raw signature bytes into the hex string we store in the cookie.
 * WHY : Cookies are text, so binary data has to be encoded. Hex keeps the
 *       format identical to the previous node:crypto implementation, so every
 *       existing logged-in session stays valid after this change.
 */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * signSessionPayload
 * WHAT: Creates the tamper-proof signature for a "userId.expiresAt" string.
 * WHY : This proves the cookie came from our server and was not edited.
 */
export async function signSessionPayload(payload: string): Promise<string> {
  // Import the key once per call. WebCrypto has no sync HMAC, hence async.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false, // not extractable - nothing needs the raw key back
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
}

/**
 * safeEqual
 * WHAT: Compares two strings without leaking timing information.
 * WHY : A plain `===` stops at the first differing character, so an attacker
 *       could measure how long the comparison took to guess the signature one
 *       character at a time. Comparing every character regardless of mismatch
 *       removes that signal. (crypto.timingSafeEqual is Node-only, so this is
 *       the portable version.)
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  // XOR each character code and OR the results together. Any difference makes
  // `diff` non-zero, and we always look at every character.
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** What we learned from a valid token. */
export interface SessionPayload {
  userId: string;
  expiresAt: number;
}

/**
 * verifySessionToken
 * WHAT: Checks a raw cookie value and returns the decoded payload, or null if
 *       the token is malformed, forged, or expired.
 * WHY : Used by middleware to reject bad cookies before any page renders, and
 *       by auth.ts so there is only ONE implementation of the cookie format.
 *
 * NOTE: This verifies the token is authentic and unexpired. It does NOT prove
 *       the user still exists, still has their role, or is not suspended -
 *       that needs a database read, which only Node-side code can do.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const parts = token.split(".");
  // Expected shape: userId.expiresAt.signature
  if (parts.length !== 3) return null;

  const [userId, expiresAtRaw, signature] = parts;
  if (!userId || !expiresAtRaw || !signature) return null;

  const payload = `${userId}.${expiresAtRaw}`;

  // 1. The signature must match what we would have produced ourselves.
  const expected = await signSessionPayload(payload);
  if (!safeEqual(signature, expected)) return null;

  // 2. The session must not have expired.
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return { userId, expiresAt };
}

/**
 * buildSessionToken
 * WHAT: Creates a signed cookie value for a user id.
 * WHY : Kept beside the verifier so the write and read logic can never drift
 *       apart. auth.ts calls this when logging someone in.
 */
export async function buildSessionToken(userId: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${await signSessionPayload(payload)}`;
}
