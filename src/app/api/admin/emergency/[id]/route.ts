/**
 * src/app/api/admin/emergency/[id]/route.ts
 * WHAT: An admin lifts a student's 7-day board pause.
 * WHY : An automated penalty that no human can undo is not fair. Real
 *       transfers do fail, banking apps do go down, and a student who
 *       genuinely sent the money deserves a way to explain. Lifting a pause
 *       clears the timestamp but keeps the count, so the history stays honest.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { fail, json, handleError } from "@/lib/api";
import { notify } from "@/lib/notifications";

type RouteContext = { params: { id: string } };

/**
 * DELETE /api/admin/emergency/:userId
 * WHAT: Removes an active board pause for one student.
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin();

    const record = await prisma.goodwillRecord.findUnique({ where: { userId: context.params.id } });
    if (!record) return fail("That student has no goodwill record.", 404);
    if (!record.boardBannedUntil || record.boardBannedUntil.getTime() <= Date.now()) {
      return fail("That student is not currently paused.", 409);
    }

    // The timestamp is cleared; helpsAbandoned stays so the pattern is visible.
    const updated = await prisma.goodwillRecord.update({
      where: { userId: record.userId },
      data: { boardBannedUntil: null, banReason: null },
    });

    await notify({
      userId: record.userId,
      title: "Your support board access is restored",
      body: "An admin reviewed your case and lifted the pause early. The support board is open to you again.",
      link: "/emergency",
    });

    return json({ userId: record.userId, boardBannedUntil: updated.boardBannedUntil });
  } catch (error) {
    return handleError(error);
  }
}
