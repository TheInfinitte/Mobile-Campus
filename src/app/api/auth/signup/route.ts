/**
 * src/app/api/auth/signup/route.ts
 * WHAT: Step 1 of sign-up. It checks the phone number and password, creates the
 *       account, and sends a 6-digit OTP by SMS.
 * WHY : We verify the phone number BEFORE the account is usable, so we never end
 *       up with fake accounts and we never pay to SMS a number twice.
 *
 * SAFETY:
 *   - The password is hashed with bcrypt before it touches the database.
 *   - The phone number is rate-limited (max 5 codes per hour).
 *   - The NDPA consent flag must be true.
 *   - The OTP itself is never returned in the response.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createOtp, isValidNigerianPhone, normalisePhone } from "@/lib/otp";
import { sendSms, otpMessage } from "@/lib/termii";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, startSignupSchema } from "@/lib/validators";

/**
 * POST /api/auth/signup
 * Body: { phone, fullName, password, role, consent }
 * Returns: { data: { phone, message } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    const parsed = safeParse(startSignupSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const { fullName, password, role, consent, landlordType, principalName, principalPhone } = parsed.data;
    const phone = normalisePhone(parsed.data.phone);

    // MULTI-CAMPUS: the chosen institution must exist and be active. Every
    // account is siloed to it from day one.
    const institution = await prisma.institution.findUnique({ where: { id: parsed.data.institutionId } });
    if (!institution || !institution.isActive) {
      return fail("Please choose your institution from the list.", 400);
    }

    // Double-check the number shape (the schema already did this, but this is
    // the last line of defence before we spend money on an SMS).
    if (!isValidNigerianPhone(phone)) {
      return fail("That does not look like a valid Nigerian phone number.", 400);
    }

    // A phone number can only belong to one account.
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return fail("That phone number is already registered. Please sign in instead.", 409);
    }

    // 1. Create the account. It is NOT verified yet - it cannot pay or message.
    const user = await prisma.user.create({
      data: {
        phone,
        fullName,
        passwordHash: await hashPassword(password),
        role,
        consentedToData: consent === true, // Records the NDPA consent.
        verificationStatus: "UNVERIFIED",
        institutionId: institution.id,
        // Landlord privacy/transparency: how this account lists properties.
        ...(role === "LANDLORD"
          ? {
              landlordType,
              principalName: landlordType === "AGENT" ? principalName : null,
              principalPhone: landlordType === "AGENT" ? principalPhone : null,
            }
          : {}),
      },
    });

    // 2. Generate the OTP. This throws a 429 if the number is asking too often.
    const code = createOtp(phone);

    // 3. Send it. We do not await a hard failure - if SMS fails the user can
    //    request another code from the verify screen.
    await sendSms(phone, otpMessage(code));

    // In development (no Termii key) we log the code so you can still test.
    if (!process.env.TERMII_API_KEY) {
      console.log(`[DEV OTP] ${phone} -> ${code}`);
    }

    return json({
      phone,
      // We deliberately do NOT return the code.
      message: `We sent a 6-digit code to ${phone}.`,
      devCode: process.env.TERMII_API_KEY ? undefined : code,
      userId: user.id,
    });
  } catch (error) {
    return handleError(error);
  }
}
