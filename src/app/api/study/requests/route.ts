/**
 * src/app/api/study/requests/route.ts
 * WHAT: The peer-to-peer material request board: freshers ask, seniors supply.
 * WHY : A fresher may need a past question nobody has uploaded yet. Asking in
 *       the open lets any senior in the same institution help.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, materialRequestSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/study/requests
 * Open requests for the viewer's institution, newest first.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const viewer = await getSessionUser();
    if (viewer?.role === "LANDLORD") return fail("The study vault is a student space.", 403);

    const institution = await getViewerInstitution();

    const requests = await prisma.materialRequest.findMany({
      where: { institutionId: institution.id, status: { in: ["OPEN", "FILLED"] } },
      include: { requester: { select: { id: true, fullName: true, level: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
    });

    return json({
      requests: requests.map((req) => ({
        id: req.id,
        department: req.department,
        courseCode: req.courseCode,
        details: req.details,
        status: req.status,
        createdAt: req.createdAt,
        requesterName: req.requester.fullName,
        requesterLevel: req.requester.level,
        isMine: viewer ? req.requesterId === viewer.id : false,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/study/requests
 * Any student may ask for a material.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only student accounts can post requests.", 403);

    const body = await readJson(request);
    const parsed = safeParse(materialRequestSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const created = await prisma.materialRequest.create({
      data: {
        requesterId: user.id,
        institutionId: user.institutionId,
        department: parsed.data.department,
        courseCode: parsed.data.courseCode,
        details: parsed.data.details ?? null,
      },
    });

    return json({ id: created.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
