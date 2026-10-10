/**
 * src/lib/auth.ts
 * WHAT: Everything about logging a user in and proving who they are on every
 *       request: hashing passwords, signing session cookies, reading the
 *       session back, and role checks.
 * WHY : We do not use a third-party auth service (it would add cost and
 *       latency). A signed HTTP-only cookie is simple, free and fast enough
 *       for a campus platform.
 *
 * SECURITY RULES FOLLOWED HERE:
 *   - Passwords are hashed with bcrypt, never stored in plain text.
 *   - The cookie is HttpOnly (JavaScript cannot read it) and SameSite=Lax.
 *   - The cookie holds ONLY a signature and a user id - no personal data.
 *   - Every API route re-checks the session on the server before acting.
 */
import bcrypt from "bcryptjs";
import { env } from "./env";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import {
  SESSION_COOKIE as SHARED_SESSION_COOKIE,
  SESSION_TTL_MS as SHARED_SESSION_TTL_MS,
  buildSessionToken,
  verifySessionToken,
} from "./session";
import type { User, UserRole } from "@prisma/client";

// Re-exported from src/lib/session.ts so existing imports keep working, while
// the cookie format itself lives in exactly one file (the Edge-safe one).
export const SESSION_COOKIE = SHARED_SESSION_COOKIE;
export const SESSION_TTL_MS = SHARED_SESSION_TTL_MS;

// -------------------------------------------------------------------------
// PASSWORDS
// -------------------------------------------------------------------------

/**
 * hashPassword
 * WHAT: Turns a plain password into a one-way bcrypt hash.
 * WHY : If the database leaks, attackers cannot read the original passwords.
 *       10 salt rounds is the standard balance between speed and safety.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * verifyPassword
 * WHAT: Checks a typed password against the stored hash.
 * WHY : bcrypt.compare does the work safely, including timing protection.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// -------------------------------------------------------------------------
// SESSION COOKIES
// -------------------------------------------------------------------------

/**
 * createSession
 * WHAT: Builds and stores the signed session cookie after a successful login.
 * WHY : This is the one place that "logs a user in". Keeping it in one function
 *       means the cookie settings are always correct.
 */
export async function createSession(userId: string): Promise<void> {
  // Token shape + signature both come from src/lib/session.ts.
  const token = await buildSessionToken(userId);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,               // JavaScript cannot steal it.
    secure: env.app.isProduction, // Only sent over HTTPS in production.
    sameSite: "lax",              // Blocks most cross-site request forgery.
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/**
 * destroySession
 * WHAT: Deletes the session cookie (logout).
 * WHY : The user must be able to sign out on a shared phone.
 */
export function destroySession(): void {
  cookies().delete(SESSION_COOKIE);
}

/**
 * getSessionUser
 * WHAT: Reads the cookie, verifies the signature and expiry, then loads the
 *       user from the database.
 * WHY : Every protected page/route calls this to know who is making the
 *       request. We load from the database each time so a deleted or banned
 *       account is rejected immediately.
 *
 * Returns null when there is no valid session.
 */
export async function getSessionUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // 1 + 2. Verify the signature and expiry with the shared Edge-safe helper,
  // so middleware and this function can never disagree about a cookie.
  const verified = await verifySessionToken(token);
  if (!verified) return null;
  const { userId } = verified;

  // 3. Load the user (they may have been deleted since the cookie was issued).
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // 4. Reject suspended accounts immediately, even with a valid cookie.
  //    Because this check lives in the ONE function every guard calls, a ban
  //    takes effect on the user's very next request - no logout needed.
  if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) return null;

  return user;
}

/**
 * requireUser
 * WHAT: Returns the logged-in user or throws a 401 error.
 * WHY : Shorter and clearer in API routes: `const user = await requireUser();`
 */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "You need to sign in to do that.");
  return user;
}

/**
 * requireRole
 * WHAT: Returns the logged-in user only if they have one of the allowed roles.
 * WHY : Admin routes must never be reachable by a normal student.
 */
export async function requireRole(...roles: UserRole[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "Your account does not have permission for that.");
  }
  return user;
}

/**
 * requireAdmin
 * WHAT: Returns the logged-in user only if they are staff (ADMIN or
 *       SUPER_ADMIN). Throws 403 otherwise.
 * WHY : Every /api/admin route needs the same two-line guard. One shared
 *       helper means adding a new staff role later is a one-line change
 *       instead of hunting down twenty files.
 */
export async function requireAdmin(): Promise<User> {
  return requireRole("ADMIN", "SUPER_ADMIN");
}

/**
 * requireSuperAdmin
 * WHAT: The strictest guard - only platform owners (SUPER_ADMIN) pass.
 * WHY : Dangerous powers (changing someone's role, banning another admin)
 *       must never be reachable by ordinary staff.
 */
export async function requireSuperAdmin(): Promise<User> {
  return requireRole("SUPER_ADMIN");
}

/**
 * isStaff
 * WHAT: Plain boolean - is this user an admin of any tier?
 * WHY : Pages and UI components often only need to show/hide something,
 *       where throwing an error would be the wrong tool.
 */
export function isStaff(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * canPayAndMessage
 * WHAT: Business rule - can this user make payments and chat with landlords?
 * WHY : Provisional (fresher) accounts may only browse and shortlist until an
 *       admin screens them and they submit a matric number.
 *       Landlords and admins are always allowed.
 */
export function canPayAndMessage(user: User): boolean {
  if (user.role === "ADMIN" || user.role === "LANDLORD") return true;
  return user.isVerified && user.verificationStatus === "VERIFIED";
}

/**
 * upgradeMessage
 * WHAT: A friendly sentence explaining what a provisional user must do.
 * WHY : We show this instead of a blunt "Access denied".
 */
export function upgradeMessage(): string {
  return "Fresher accounts can browse and shortlist. Submit your matric number after registration to unlock payments, escrow and messaging.";
}

// -------------------------------------------------------------------------
// API ERROR TYPE
// -------------------------------------------------------------------------

/**
 * ApiError
 * WHAT: An error that carries an HTTP status code.
 * WHY : API routes catch this and turn it into a clean JSON response with the
 *       right status, instead of a stack trace.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}
