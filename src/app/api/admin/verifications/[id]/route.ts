/**
 * src/app/api/admin/verifications/[id]/route.ts
 * WHAT: An admin's decision on one verification: approve, reject, or ask for a
 *       clearer document.
 * WHY : Approving a student ID unlocks payments. Approving a landlord document
 *       grants the Verified badge. Rejecting must explain why, so the user can
 *       fix it instead of giving up.
 *
 * The decrypted number is available to the admin here (that is the whole point
 * of the review) but it is never written into a notification or a log.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireAdmin } from "@/lib/auth";
import { decrypt, maskIdentifier } from "@/lib/encrypt";
import { notify } from "@/lib/notifications";
import { verificationMessage } from "@/lib/termii";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, reviewVerificationSchema } from "@/lib/validators";

type RouteContext = { params: { id: string } };

/**
 * GET /api/admin/verifications/:id
 * Returns one record, including the decrypted identifier for checking against
 * the school's list. Admin only - and the value is never shown to anyone else.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin();

    const record = await prisma.verificationRecord.findUnique({
      where: { id: context.params.id },
      include: { user: { select: { id: true, fullName: true, phone: true, role: true } } },
    });

    if (!record) return fail("That verification record was not found.", 404);

    // Decrypt only for this admin view.
    const decrypted = decrypt(record.matricNumberEnc) || decrypt(record.jambRegNumberEnc) || decrypt(record.nationalIdEnc);

    return json({
      record: {
        id: record.id,
        type: record.type,
        purpose: record.purpose,
        status: record.status,
        idCardUrl: record.idCardUrl,
        documentUrls: record.documentUrls,
        adminNote: record.adminNote,
        submittedAt: record.submittedAt,
        user: record.user,
        // Masked by default; the full value is returned only to an admin.
        identifierMasked: maskIdentifier(decrypted),
        identifierFull: decrypted,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/admin/verifications/:id
 * Body: { decision: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO", note? }
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    const body = await readJson(request);
    const parsed = safeParse(reviewVerificationSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const record = await prisma.verificationRecord.findUnique({
      where: { id: context.params.id },
      include: { user: true },
    });

    if (!record) return fail("That verification record was not found.", 404);

    const { decision, note } = parsed.data;

    // -----------------------------------------------------------------
    // 1. Update the record itself.
    // -----------------------------------------------------------------
    await prisma.verificationRecord.update({
      where: { id: record.id },
      data: {
        status: decision,
        adminNote: note ?? null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    // -----------------------------------------------------------------
    // 2. Decide what this means for the user's account.
    // -----------------------------------------------------------------
    const isLandlordDoc = record.type === "LANDLORD_DOC";

    if (decision === "APPROVED") {
      // A matric upgrade copies the newly issued (encrypted) matric number
      // onto the account once an admin has checked it against the ID card.
      const isMatricUpgrade = record.purpose === "MATRIC_UPGRADE";
      // A fresher's FIRST approval (JAMB) stays PROVISIONAL; a matric-number
      // approval (initial or upgrade) makes the account fully VERIFIED.
      const newStatus = record.type === "FRESHER_JAMB" && !isMatricUpgrade ? "PROVISIONAL" : "VERIFIED";

      await prisma.user.update({
        where: { id: record.userId },
        data: {
          verificationStatus: newStatus,
          isVerified: newStatus === "VERIFIED",
          ...(isMatricUpgrade && record.matricNumberEnc
            ? { matricNumberEnc: record.matricNumberEnc }
            : {}),
        },
      });

      // STUDY VAULT WELCOME CREDIT: the first student approval grants the
      // institution's free downloads, so freshers can study before they have
      // anything of their own to upload. Exactly once (purpose = INITIAL).
      if (!isLandlordDoc && record.purpose === "INITIAL") {
        const fresh = await prisma.user.findUnique({
          where: { id: record.userId },
          include: { institution: true },
        });
        if (fresh && fresh.studyDownloadsLeft === 0) {
          await prisma.user.update({
            where: { id: fresh.id },
            data: { studyDownloadsLeft: fresh.institution.welcomeCredits },
          });
        }
      }

      // A landlord whose documents were approved gets the Verified badge on all
      // of their existing listings.
      if (isLandlordDoc) {
        await prisma.lodge.updateMany({ where: { landlordId: record.userId }, data: { isVerified: true } });
      }

      await notify({
        userId: record.userId,
        title: decision === "APPROVED" && newStatus === "PROVISIONAL" ? "Fresher status approved 🎓" : "You are verified ✅",
        body:
          newStatus === "PROVISIONAL"
            ? "You can now browse and shortlist lodges. Submit your matric number after registration to unlock payments and messaging."
            : "Your account is fully verified. You can now pay with escrow protection and message landlords.",
        link: "/profile",
        sms: true,
        smsBody: verificationMessage(record.user.fullName.split(" ")[0], true),
      });
    } else if (decision === "REJECTED") {
      // A rejection of the ONLY approved record would demote the user, so we
      // only demote if they have no other approved record.
      const otherApproved = await prisma.verificationRecord.count({
        where: { userId: record.userId, status: "APPROVED", id: { not: record.id } },
      });

      if (otherApproved === 0) {
        await prisma.user.update({
          where: { id: record.userId },
          data: { verificationStatus: "REJECTED", isVerified: false },
        });
      }

      // Hide the listings of a landlord whose documents were rejected.
      if (isLandlordDoc) {
        await prisma.lodge.updateMany({ where: { landlordId: record.userId }, data: { isVerified: false, status: "UNDER_REVIEW" } });
      }

      await notify({
        userId: record.userId,
        title: "Verification not approved",
        body: note
          ? `Our team could not approve your document: ${note}. You can upload a clearer copy.`
          : "Our team could not approve your document. You can upload a clearer copy.",
        link: "/profile",
        sms: true,
        smsBody: verificationMessage(record.user.fullName.split(" ")[0], false, note),
      });
    } else {
      // NEEDS_MORE_INFO - the account stays where it was.
      await notify({
        userId: record.userId,
        title: "We need a clearer document",
        body: note ?? "Please upload a clearer photo of your document so we can verify you.",
        link: "/profile",
      });
    }

    // Guard against a nonsense decision slipping through the schema.
    if (!["APPROVED", "REJECTED", "NEEDS_MORE_INFO"].includes(decision)) {
      throw new ApiError(400, "That decision is not valid.");
    }

    return json({ id: record.id, status: decision });
  } catch (error) {
    return handleError(error);
  }
}
