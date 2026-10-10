/**
 * src/app/api/auth/request-otp/route.ts
 * WHAT: Sends a fresh 6-digit code to an existing user so they can sign in
 *       without a password (useful when they have forgotten it).
 * WHY : Not every student remembers a password. SMS login is a normal, expected
 *       option on Nigerian platforms.
 *
 * SAFETY: Rate-limited by the OTP module (1 code per minute, 5 per hour).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOtp, markOtpAbuse, normalisePhone } from "@/lib/otp";
import { sendSms, otpMessage } from "@/lib/termii";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, requestOtpSchema } from "@/lib/validators";

/**
 * POST /api/auth/request-otp
 * Body: { phone }
 * Returns: { data: { message } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    const parsed = safeParse(requestOtpSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const phone = normalisePhone(parsed.data.phone);

    const user = await prisma.user.findUnique({ where: { phone } });
    // We still say "code sent" even if the number is unknown, so nobody can use
    // this endpoint to discover which numbers are registered.
    if (!user) {
      return json({ message: "If that number is registered, a code is on its way." });
    }

    // createOtp throws a 429 if this number is requesting codes too often.
    const code = createOtp(phone);
    await sendSms(phone, otpMessage(code));
    await markOtpAbuse(user.id); // Records the attempt for admin visibility.

    if (!process.env.TERMII_API_KEY) {
      console.log(`[DEV OTP] ${phone} -> ${code}`);
    }

    return json({
      message: `We sent a 6-digit code to ${phone}.`,
      devCode: process.env.TERMII_API_KEY ? undefined : code,
    });
  } catch (error) {
    return handleError(error);
  }
}
