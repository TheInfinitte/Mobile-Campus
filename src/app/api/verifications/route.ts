/**
 * src/app/api/verifications/route.ts
 * WHAT: Handles a user submitting proof of who they are:
 *       - Student: matric number + a photo of the student ID card.
 *       - Fresher: JAMB registration number + admission letter / portal screenshot.
 *       - Landlord: a document proving ownership or caretaker management.
 *       Also lists the signed-in user's own submissions.
 * WHY : Verification is what unlocks the platform. It has to be strict about
 *       privacy (numbers encrypted) and clear about what each role must upload.
 *
 * PRIVACY (NDPA):
 *   - Matric / JAMB / ID numbers are encrypted with AES-256-GCM before saving.
 *   - Only the last 4 characters are stored in plain text, for admin search.
 *   - The full value is never returned by any API.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encrypt, lastFour } from "@/lib/encrypt";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, submitVerificationSchema } from "@/lib/validators";
import { isAllowedImage } from "@/lib/cloudinary";

/**
 * GET /api/verifications
 * Returns the signed-in user's verification history (masked).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const records = await prisma.verificationRecord.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      // We select only safe fields - never the encrypted columns.
      select: {
        id: true,
        type: true,
        purpose: true,
        status: true,
        identifierLast4: true,
        idCardUrl: true,
        documentUrls: true,
        adminNote: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    return json({ records });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/verifications
 * Body: { type, matricNumber?, jambRegNumber?, nationalId?, documentUrls, consent }
 * Returns: { data: { id, status } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(submitVerificationSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // Limit submissions: 5 per day per user. Stops someone spamming the queue.
    const limit = rateLimit(`verify:${user.id}`, 5, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      return fail("You have submitted several requests today. Please wait for our team to review them.", 429);
    }

    const { type, documentUrls, idCardUrl } = parsed.data;

    // Every document URL must be an HTTPS Cloudinary link.
    if (!documentUrls.every(isAllowedImage) || (idCardUrl && !isAllowedImage(idCardUrl))) {
      return fail("Please upload your documents again - one of the image links is not valid.", 400);
    }

    // Only students and landlords verify. Admins are created by us directly.
    if (user.role === "ADMIN") {
      return fail("Administrator accounts do not need verification.", 400);
    }

    // Landlords must submit a LANDLORD_DOC; students must not.
    if (user.role === "LANDLORD" && type !== "LANDLORD_DOC") {
      return fail("Landlords verify with an ownership or management document.", 400);
    }
    if (user.role === "STUDENT" && type === "LANDLORD_DOC") {
      return fail("Students verify with a student ID or JAMB admission proof.", 400);
    }

    // A student who is already fully verified cannot submit a fresher JAMB proof.
    if (user.verificationStatus === "VERIFIED" && type === "FRESHER_JAMB") {
      return fail("You are already verified. You do not need to submit JAMB proof.", 400);
    }

    // Reject an identical pending submission so the queue stays clean.
    const alreadyPending = await prisma.verificationRecord.findFirst({
      where: { userId: user.id, type, status: "PENDING" },
    });
    if (alreadyPending) {
      return fail("You already have a pending request of this type. Please wait for our review.", 409);
    }

    // Encrypt the sensitive identifier before it is stored.
    const identifier =
      type === "STUDENT_ID"
        ? parsed.data.matricNumber
        : type === "FRESHER_JAMB"
          ? parsed.data.jambRegNumber
          : parsed.data.nationalId;

    const record = await prisma.verificationRecord.create({
      data: {
        userId: user.id,
        type,
        status: "PENDING",
        // Encrypted at rest. This is the NDPA-critical line.
        matricNumberEnc: type === "STUDENT_ID" && identifier ? encrypt(identifier) : null,
        jambRegNumberEnc: type === "FRESHER_JAMB" && identifier ? encrypt(identifier) : null,
        nationalIdEnc: parsed.data.nationalId && type === "LANDLORD_DOC" ? encrypt(parsed.data.nationalId) : null,
        identifierLast4: identifier ? lastFour(identifier) : null,
        // The student ID card image, required for both student types.
        idCardUrl: idCardUrl ?? null,
        documentUrls,
        phoneNumber: user.phone,
      },
    });

    // Tell the user what happens next.
    await notify({
      userId: user.id,
      title: "Verification received",
      body: "Our team will review your document within 24 hours. You will get an SMS when it is done.",
      link: "/profile",
    });

    return json({ id: record.id, status: record.status });
  } catch (error) {
    return handleError(error);
  }
}
