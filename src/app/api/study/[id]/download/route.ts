/**
 * src/app/api/study/[id]/download/route.ts
 * WHAT: Releases a study file and spends one download credit.
 * WHY : The give-to-get economy: freshers start with welcome credits; after
 *       that you earn credits by contributing. Uploading your own material or
 *       being an admin never spends credits.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, json, handleError } from "@/lib/api";

type RouteContext = { params: { id: string } };

/**
 * POST /api/study/:id/download
 * Returns: { data: { fileUrl, creditsLeft } } or 402 when out of credits.
 */
export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role === "LANDLORD") return fail("The study vault is a student space.", 403);

    const doc = await prisma.studyDocument.findUnique({ where: { id: context.params.id } });
    if (!doc || doc.status !== "APPROVED") return fail("That material is not available.", 404);

    // Silo: materials only travel within their own institution.
    if (doc.institutionId !== user.institutionId && user.role !== "ADMIN") {
      return fail("This material belongs to a different institution.", 403);
    }

    const isUploader = doc.uploaderId === user.id;

    // Spending a credit (the uploader and admins never pay for their own work).
    if (!isUploader && user.role !== "ADMIN") {
      if (user.studyDownloadsLeft <= 0) {
        return fail(
          "You are out of download credits. Upload a past question or note to earn 2 credits - that is how the vault stays full.",
          402
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { studyDownloadsLeft: { decrement: 1 } },
      });
    }

    await prisma.studyDocument.update({
      where: { id: doc.id },
      data: { downloads: { increment: 1 } },
    });

    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { studyDownloadsLeft: true },
    });

    return json({ fileUrl: doc.fileUrl, creditsLeft: fresh?.studyDownloadsLeft ?? 0 });
  } catch (error) {
    return handleError(error);
  }
}
