/**
 * src/app/api/gigs/[id]/route.ts
 * WHAT: Returns one gig, lets a worker accept it, and lets the poster cancel it.
 * WHY : Accepting a gig is a two-sided action - the poster needs to know someone
 *       has committed, and the worker needs the task marked as taken so two people
 *       do not both do it.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { escrowFeeBreakdown } from "@/lib/fees";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";

type RouteContext = { params: { id: string } };

/**
 * GET /api/gigs/:id
 * Returns the gig, the poster and the escrow fee for taking it.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const gig = await prisma.gig.findUnique({
      where: { id: context.params.id },
      include: {
        poster: { select: { id: true, fullName: true, phone: true, isVerified: true, avatarUrl: true, level: true } },
        worker: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
      },
    });

    if (!gig) return fail("That task was not found.", 404);

    // Fees for paying the worker through escrow.
    const fees = await escrowFeeBreakdown(gig.budgetKobo);

    const viewer = await getSessionUser();

    return json({
      gig: {
        id: gig.id,
        // Which side of the board: services wanted or services offered.
        gigType: gig.gigType,
        title: gig.title,
        description: gig.description,
        category: gig.category,
        area: gig.area,
        budgetKobo: gig.budgetKobo,
        isNegotiable: gig.isNegotiable,
        dueDate: gig.dueDate,
        status: gig.status,
        createdAt: gig.createdAt,
        poster: gig.poster,
        worker: gig.worker,
        feeKobo: fees.payerFeeKobo,
        feeLines: fees.lines,
        totalKobo: gig.budgetKobo + fees.payerFeeKobo,
      },
      isMine: viewer?.id === gig.posterId,
      iAmWorker: viewer?.id === gig.workerId,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/gigs/:id
 * Body: { action: "ACCEPT" | "COMPLETE" | "CANCEL" }
 *
 * ACCEPT   - a student offers to do the job (gig -> ASSIGNED).
 * COMPLETE - the poster says the job is done (gig -> COMPLETED).
 * CANCEL   - the poster withdraws the task.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);

    const body = (await readJson(request)) as { action?: string };
    const action = body.action;
    if (!action || !["ACCEPT", "COMPLETE", "CANCEL"].includes(action)) {
      return fail("That action is not allowed.", 400);
    }

    const gig = await prisma.gig.findUnique({
      where: { id: context.params.id },
      include: { poster: { select: { id: true, fullName: true } } },
    });
    if (!gig) return fail("That task was not found.", 404);

    if (action === "ACCEPT") {
      // Anyone but the poster may accept, and only while it is open.
      if (gig.posterId === user.id) return fail("You cannot accept your own task.", 400);
      if (gig.status !== "OPEN") return fail("Someone has already taken this task.", 409);
      if (!user.isVerified) return fail("Verify your student status before accepting tasks.", 403);

      const updated = await prisma.gig.update({
        where: { id: gig.id },
        data: { workerId: user.id, status: "ASSIGNED" },
      });

      await notify({
        userId: gig.posterId,
        title: "Someone accepted your task",
        body: `${user.fullName} will do "${gig.title}". Pay into escrow so they know the money is safe.`,
        link: `/gigs/${gig.id}`,
        sms: true,
        smsBody: `${user.fullName} accepted your task "${gig.title}" on Mobile Campus.`,
      });

      return json({ id: updated.id, status: updated.status });
    }

    if (action === "COMPLETE") {
      if (gig.posterId !== user.id) return fail("Only the person who posted the task can mark it complete.", 403);
      if (gig.status !== "ASSIGNED" && gig.status !== "IN_PROGRESS") {
        return fail("This task has not been started yet.", 409);
      }

      const updated = await prisma.gig.update({ where: { id: gig.id }, data: { status: "COMPLETED" } });
      return json({ id: updated.id, status: updated.status });
    }

    // CANCEL
    if (gig.posterId !== user.id && user.role !== "ADMIN") {
      return fail("Only the person who posted the task can cancel it.", 403);
    }
    if (gig.status === "COMPLETED") return fail("A completed task cannot be cancelled.", 409);

    const cancelled = await prisma.gig.update({ where: { id: gig.id }, data: { status: "CANCELLED" } });

    if (gig.workerId) {
      await notify({
        userId: gig.workerId,
        title: "Task cancelled",
        body: `"${gig.title}" was cancelled by the poster.`,
        link: "/gigs",
      });
    }

    return json({ id: cancelled.id, status: cancelled.status });
  } catch (error) {
    return handleError(error);
  }
}
