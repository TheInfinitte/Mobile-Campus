/**
 * src/app/api/verifications/upgrade-matric/route.ts
 * WHAT: Lets a verified fresher (JAMB-based account) add their matric number
 *       once the school issues it, with a fresh student ID card photo.
 * WHY : Freshers join before matric numbers exist. When the number arrives we
 *       want a SMOOTH re-verification: one form, one admin check, and the
 *       account quietly upgrades to full VERIFIED status.
 *
 * PRIVACY: the matric number is encrypted before storage; only the last four
 * characters are kept in plain text for admin search.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encrypt, lastFour } from "@/lib/encrypt";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, matricUpgradeSchema } from "@/lib/validators";
import { isAllowedImage } from "@/lib/cloudinary";
import { notify } from "@/lib/notifications";

/**
 * POST /api/verifications/upgrade-matric
 * Body: { matricNumber, idCardUrl, consent }
 * Returns: { data: { id, status } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    // Only students upgrade; landlords and admins have different flows.
    if (user.role !== "STUDENT") {
      return fail("Only student accounts can add a matric number.", 400);
    }

    const body = await readJson(request);
    const parsed = safeParse(matricUpgradeSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    if (!isAllowedImage(parsed.data.idCardUrl)) {
      return fail("Please upload the ID card photo again - the link is not valid.", 400);
    }

    // One pending upgrade at a time keeps the admin queue clean.
    const pending = await prisma.verificationRecord.findFirst({
      where: { userId: user.id, purpose: "MATRIC_UPGRADE", status: "PENDING" },
    });
    if (pending) {
      return fail("Your matric upgrade is already being reviewed. Please wait for it.", 409);
    }

    const record = await prisma.verificationRecord.create({
      data: {
        userId: user.id,
        type: "STUDENT_ID",
        purpose: "MATRIC_UPGRADE",
        status: "PENDING",
        matricNumberEnc: encrypt(parsed.data.matricNumber),
        identifierLast4: lastFour(parsed.data.matricNumber),
        idCardUrl: parsed.data.idCardUrl,
        phoneNumber: user.phone,
      },
    });

    await notify({
      userId: user.id,
      title: "Matric upgrade received",
      body: "Our team will check your matric number against your ID card, usually within 24 hours.",
      link: "/profile/verification",
    });

    return json({ id: record.id, status: record.status });
  } catch (error) {
    return handleError(error);
  }
}
