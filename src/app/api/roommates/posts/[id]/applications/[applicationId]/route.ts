/**
 * src/app/api/roommates/posts/[id]/applications/[applicationId]/route.ts
 * WHAT: The post author accepts or declines one application to their board post.
 * WHY : Accepting has to change two things at once - the application's status and
 *       the number of slots left on the post. Doing that in one transaction is
 *       what stops a group ending up with five people in a four-person flat.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { json, fail, handleError, readJson } from "@/lib/api";
import { safeParse, roommateApplicationDecisionSchema } from "@/lib/validators";

/** Next.js passes the two URL segments through `params`. */
type RouteContext = { params: { id: string; applicationId: string } };

/**
 * PATCH /api/roommates/posts/:id/applications/:applicationId
 * Body: { decision: "ACCEPTED" | "DECLINED" }
 */
export async function PATCH(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const body = await readJson(_request);
    const parsed = safeParse(roommateApplicationDecisionSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const application = await prisma.roommateApplication.findUnique({
      where: { id: context.params.applicationId },
      include: { post: true, user: { select: { fullName: true } } },
    });

    if (!application || application.postId !== context.params.id) {
      return fail("That application was not found.", 404);
    }

    // Only the person who posted may decide.
    if (application.post.authorId !== user.id) {
      return fail("Only the author of this post can respond to applications.", 403);
    }

    if (application.status !== "PENDING") {
      return fail("You have already responded to this application.", 409);
    }

    const accepting = parsed.data.decision === "ACCEPTED";

    // A group cannot take more people than it has room for.
    if (accepting && application.post.slotsLeft <= 0) {
      return fail("This group is already full. Decline someone first if you changed your mind.", 409);
    }

    // Both writes happen together: either the slot is filled, or nothing changes.
    await prisma.$transaction(async (db) => {
      await db.roommateApplication.update({
        where: { id: application.id },
        data: { status: parsed.data.decision },
      });

      if (accepting) {
        await db.roommatePost.update({
          where: { id: application.postId },
          data: {
            slotsLeft: { decrement: 1 },
            // A post with no slots left is no longer accepting applications.
            ...(application.post.slotsLeft - 1 <= 0 ? { status: "FILLED" as const } : {}),
          },
        });
      }
    });

    // Tell the applicant what happened. An acceptance is worth an SMS because
    // the person will be planning to move.
    await notify({
      userId: application.userId,
      title: accepting ? "You are in the group" : "Roommate application",
      body: accepting
        ? `${user.fullName} accepted your application to "${application.post.title}". Message them to arrange a viewing.`
        : `${user.fullName} chose someone else for "${application.post.title}". There are other posts on the board.`,
      link: `/roommates/${application.postId}`,
      sms: accepting,
      smsBody: accepting
        ? `Good news - ${user.fullName} accepted your roommate application on Mobile Campus. Open the app to reply.`
        : undefined,
    });

    return json({ id: application.id, status: parsed.data.decision });
  } catch (error) {
    return handleError(error);
  }
}
