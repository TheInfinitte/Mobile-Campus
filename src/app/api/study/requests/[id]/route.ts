/**
 * src/app/api/study/requests/[id]/route.ts
 * WHAT: The requester closes or marks their own request as fulfilled, linking
 *       the approved document that helped them.
 * WHY : Keeping the decision with the requester means a request is only marked
 *       FILLED when they actually got what they needed.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";

type RouteContext = { params: { id: string } };

/**
 * PATCH /api/study/requests/:id
 * Body: { status: "FILLED" | "CLOSED", docId? }
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const record = await prisma.materialRequest.findUnique({ where: { id: context.params.id } });
    if (!record) return fail("That request was not found.", 404);
    if (record.requesterId !== user.id) return fail("Only the person who asked can update this request.", 403);

    const body = (await readJson(request)) as { status?: string; docId?: string };
    if (body.status !== "FILLED" && body.status !== "CLOSED") {
      return fail("Choose FILLED or CLOSED.", 400);
    }

    // If a document is linked, it must be an approved doc from the same school.
    if (body.docId) {
      const doc = await prisma.studyDocument.findUnique({ where: { id: body.docId } });
      if (!doc || doc.status !== "APPROVED" || doc.institutionId !== record.institutionId) {
        return fail("That document cannot be linked to this request.", 400);
      }
    }

    await prisma.materialRequest.update({
      where: { id: record.id },
      data: { status: body.status, fulfilledByDocId: body.docId ?? null },
    });

    return json({ id: record.id, status: body.status });
  } catch (error) {
    return handleError(error);
  }
}
