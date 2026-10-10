/**
 * src/app/api/admin/reports/[id]/route.ts
 * WHAT: Updates the status of a report (investigating / resolved / dismissed).
 * WHY : Every report needs a closing state so the queue does not grow forever,
 *       and so a user who reported a scam can be told what happened.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";

type RouteContext = { params: { id: string } };

/** The statuses an admin can set. */
const ALLOWED_STATUSES = ["INVESTIGATING", "RESOLVED", "DISMISSED"] as const;

/**
 * PATCH /api/admin/reports/:id
 * Body: { status, adminNote? }
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    await requireAdmin();

    const body = (await readJson(request)) as { status?: string; adminNote?: string };
    const status = body.status;

    if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return fail("That status is not valid.", 400);
    }

    const report = await prisma.report.findUnique({ where: { id: context.params.id } });
    if (!report) return fail("That report was not found.", 404);

    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: status as "RESOLVED",
        adminNote: body.adminNote ?? report.adminNote,
        resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? new Date() : null,
      },
    });

    // When a SCAM report about a lodge is resolved, put the listing back into
    // search. If it is dismissed as a false report, restore it too.
    if (report.lodgeId && (status === "RESOLVED" || status === "DISMISSED")) {
      const lodge = await prisma.lodge.findUnique({ where: { id: report.lodgeId } });
      if (lodge && lodge.status === "UNDER_REVIEW") {
        await prisma.lodge.update({ where: { id: lodge.id }, data: { status: "ACTIVE" } });
      }
    }

    // Let the reporter know the outcome.
    if (status !== "INVESTIGATING") {
      await notify({
        userId: report.reporterId,
        title: status === "RESOLVED" ? "Thank you - action taken" : "Report closed",
        body:
          status === "RESOLVED"
            ? "We reviewed your report and took action. Thank you for keeping the community safe."
            : "We reviewed your report but could not find enough evidence to act. Thank you for telling us.",
        link: "/profile",
      });
    }

    return json({ id: updated.id, status: updated.status });
  } catch (error) {
    return handleError(error);
  }
}
