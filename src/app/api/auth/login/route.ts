/**
 * src/app/api/auth/login/route.ts
 * WHAT: Signs a user in with their phone number and password.
 * WHY : Most returning users will log in with a password - it is faster than
 *       waiting for an SMS. OTP login is available as a fallback route.
 *
 * SAFETY:
 *   - Rate-limited to 8 attempts per 15 minutes per phone number, which stops
 *     password guessing.
 *   - We always compare against a bcrypt hash, never a plain password.
 *   - The same generic error is returned for "no such number" and "wrong
 *     password" so attackers cannot discover which numbers are registered.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { normalisePhone } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, loginSchema } from "@/lib/validators";

/**
 * POST /api/auth/login
 * Body: { phone, password }
 * Returns: { data: { user } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    const parsed = safeParse(loginSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const phone = normalisePhone(parsed.data.phone);

    // Limit guessing: 8 tries per 15 minutes for this number.
    const limit = rateLimit(`login:${phone}`, 8, 15 * 60 * 1000);
    if (!limit.allowed) {
      return fail(`Too many attempts. Please try again in ${Math.ceil(limit.retryAfterMs / 60000)} minutes.`, 429);
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    // One message for both failure cases, on purpose.
    if (!user) {
      return fail("That phone number or password is incorrect.", 401);
    }

    const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordOk) {
      return fail("That phone number or password is incorrect.", 401);
    }

    // --- SUSPENSION CHECK ---
    // Password is correct, but a moderator may have suspended this account.
    // We only reveal this AFTER the password check, so an attacker cannot use
    // the message to confirm which numbers have real accounts.
    // Expired bans are ignored - they lapse by themselves, no admin action.
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      const days = Math.ceil((user.bannedUntil.getTime() - Date.now()) / 86_400_000);
      const when = days > 1 ? `${days} days` : days === 1 ? "1 day" : "a few hours";
      // Trim a trailing full stop from the stored reason so the sentence does
      // not end with ".." when the admin already punctuated it.
      const cleanReason = user.banReason?.trim().replace(/\.+$/, "") ?? "";
      const reason = cleanReason ? ` Reason given: ${cleanReason}.` : "";
      return fail(
        `This account is suspended for ${when}.${reason} If you think this is a mistake, contact support from the login screen.`,
        403,
      );
    }

    await createSession(user.id);

    return json({
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
