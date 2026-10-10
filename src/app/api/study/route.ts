/**
 * src/app/api/study/route.ts
 * WHAT: The Past Questions & Study Vault list + uploads.
 * WHY : Academic materials differ per school AND department, so the vault is
 *       siloed by institution and filterable by department/course. Uploads go
 *       through admin review (no junk, no copyright abuse) and earn download
 *       credits - the give-to-get loop.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, studyDocSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/study?department=Computer%20Science&course=CSC%20201&scope=mine
 * Approved documents for the viewer's institution. scope=mine also returns the
 * viewer's own pending/rejected uploads so they can track review status.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const department = url.searchParams.get("department")?.trim() ?? "";
    const course = url.searchParams.get("course")?.trim() ?? "";
    const mine = url.searchParams.get("scope") === "mine";
    const viewer = await getSessionUser();
    if (viewer?.role === "LANDLORD") return fail("The study vault is a student space.", 403);

    const institution = await getViewerInstitution();

    const documents = await prisma.studyDocument.findMany({
      where: mine
        ? { uploaderId: viewer?.id ?? "", institutionId: institution.id }
        : {
            institutionId: institution.id,
            status: "APPROVED",
            ...(department ? { department: { equals: department, mode: "insensitive" } } : {}),
            ...(course ? { courseCode: { contains: course, mode: "insensitive" } } : {}),
          },
      include: { uploader: { select: { id: true, fullName: true, level: true } } },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    // The viewer's credit balance travels with every list response so the UI
    // can always show "3 downloads left".
    const me = viewer
      ? await prisma.user.findUnique({
          where: { id: viewer.id },
          select: { studyDownloadsLeft: true, studyUploadsApproved: true },
        })
      : null;

    return json({
      documents: documents.map((doc) => ({
        id: doc.id,
        department: doc.department,
        courseCode: doc.courseCode,
        title: doc.title,
        kind: doc.kind,
        description: doc.description,
        pages: doc.pages,
        downloads: doc.downloads,
        status: doc.status,
        createdAt: doc.createdAt,
        uploaderName: doc.uploader.fullName,
        isMine: viewer ? doc.uploaderId === viewer.id : false,
      })),
      credits: me?.studyDownloadsLeft ?? 0,
      uploadsApproved: me?.studyUploadsApproved ?? 0,
      welcomeCredits: institution.welcomeCredits,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/study
 * Any student may upload; the document stays PENDING until an admin approves.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only student accounts can upload materials.", 403);

    const body = await readJson(request);
    const parsed = safeParse(studyDocSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const doc = await prisma.studyDocument.create({
      data: {
        uploaderId: user.id,
        institutionId: user.institutionId,
        department: parsed.data.department,
        courseCode: parsed.data.courseCode,
        title: parsed.data.title,
        kind: parsed.data.kind,
        description: parsed.data.description ?? null,
        fileUrl: parsed.data.fileUrl,
        pages: parsed.data.pages ?? null,
        status: "PENDING",
      },
    });

    // Tell the uploader what happens next so a pending file never looks lost.
    await notify({
      userId: user.id,
      title: "Material received 📚",
      body: "Your upload is waiting for a moderator check. Once approved it goes live and you earn 2 download credits.",
      link: "/study",
    });

    return json({ id: doc.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
