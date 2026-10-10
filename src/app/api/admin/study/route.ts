/**
 * src/app/api/admin/study/route.ts
 * WHAT: Moderation queue for Study Vault uploads. Approval puts the document
 *       live and pays the uploader in download credits (give-to-get).
 * WHY : A human check keeps the vault free of junk and copyright problems, and
 *       the credit reward is what makes students keep contributing.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { CREDITS_PER_APPROVED_UPLOAD, CREDIT_CAP } from "@/lib/study-credits";

/**
 * GET /api/admin/study?status=PENDING
 * Documents awaiting review (or all, with status=ALL), with uploader identity.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "PENDING";

    const documents = await prisma.studyDocument.findMany({
      where: { ...(status !== "ALL" ? { status: status as "PENDING" } : {}) },
      include: {
        uploader: { select: { id: true, fullName: true, phone: true, level: true } },
        institution: { select: { shortName: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return json({
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        department: doc.department,
        courseCode: doc.courseCode,
        kind: doc.kind,
        description: doc.description,
        fileUrl: doc.fileUrl,
        pages: doc.pages,
        status: doc.status,
        downloads: doc.downloads,
        createdAt: doc.createdAt,
        institution: doc.institution.shortName,
        uploader: doc.uploader,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/admin/study
 * Body: { id, decision: "APPROVED" | "REJECTED", note? }
 * Approval: document goes live + uploader earns credits (capped).
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = (await readJson(request)) as { id?: string; decision?: string; note?: string };
    if (!body.id || (body.decision !== "APPROVED" && body.decision !== "REJECTED")) {
      return fail("Provide the document id and a decision.", 400);
    }

    const doc = await prisma.studyDocument.findUnique({ where: { id: body.id } });
    if (!doc) return fail("That document was not found.", 404);

    await prisma.studyDocument.update({
      where: { id: doc.id },
      data: { status: body.decision },
    });

    if (body.decision === "APPROVED") {
      // GIVE-TO-GET: reward the contribution, capped so it cannot be farmed.
      const uploader = await prisma.user.findUnique({ where: { id: doc.uploaderId } });
      if (uploader) {
        await prisma.user.update({
          where: { id: uploader.id },
          data: {
            studyUploadsApproved: { increment: 1 },
            studyDownloadsLeft: Math.min(CREDIT_CAP, uploader.studyDownloadsLeft + CREDITS_PER_APPROVED_UPLOAD),
          },
        });
      }
    }

    await notify({
      userId: doc.uploaderId,
      title: body.decision === "APPROVED" ? "Your material is live " : "Your upload was not approved",
      body:
        body.decision === "APPROVED"
          ? `"${doc.title}" is now in the vault and you earned ${CREDITS_PER_APPROVED_UPLOAD} download credits.`
          : `Our moderators could not approve "${doc.title}". ${body.note ?? "Check that it is a readable past question or note."}`,
      link: "/study",
    });

    return json({ id: doc.id, status: body.decision });
  } catch (error) {
    return handleError(error);
  }
}
