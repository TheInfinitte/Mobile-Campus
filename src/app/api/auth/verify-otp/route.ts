/**
 * src/app/api/auth/verify-otp/route.ts
 * WHAT: Step 2 of sign-up. Checks the SMS code and logs the user in.
 * WHY : Only after the code is correct do we trust that this person owns the
 *       phone number. That is what makes the whole platform's phone-number
 *       identity reliable.
 *
 * SAFETY:
 *   - The code is compared as a hash, and is deleted after 5 wrong attempts.
 *   - On success the attempt counter is reset so a genuine user is not punished.
 *   - A session cookie is set only for a real, existing user.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { normalisePhone, verifyOtp } from "@/lib/otp";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, verifySignupSchema } from "@/lib/validators";

/**
 * POST /api/auth/verify-otp
 * Body: { phone, code }
 * Returns: { data: { user } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    const parsed = safeParse(verifySignupSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const phone = normalisePhone(parsed.data.phone);

    // Throws a 400 (wrong/expired) or 429 (too many attempts) if the code fails.
    verifyOtp(phone, parsed.data.code);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // This should not happen - signup creates the user before sending a code.
      return fail("We could not find your account. Please sign up again.", 404);
    }

    // Clear the OTP attempt counter now that they have proved ownership.
    await prisma.user.update({ where: { id: user.id }, data: { otpAttempts: 0 } });

    // Log them in by setting the signed session cookie.
    await createSession(user.id);

    // A friendly first notification.
    await notify({
      userId: user.id,
      title: "Welcome to Mobile Campus 👋",
      body:
        user.role === "LANDLORD"
          ? "Upload your ownership document to get the Verified badge on your listings."
          : "Start by verifying your student status. Verified students can pay rent with escrow protection.",
      link: "/profile",
    });

    // Return only the fields the client needs. Never return the password hash.
    return json({
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
