/**
 * src/app/api/reports/route.ts
 * WHAT: Files a scam / fake-listing / harassment report into the admin queue.
 * WHY : Community policing is the cheapest and fastest defence against scammers.
 *       A one-tap report button on every listing makes it easy to flag a problem.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, reportSchema } from "@/lib/validators";

/**
 * POST /api/reports
 * Body: { type, details, lodgeId?, marketItemId?, gigId?, reportedUserId? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(reportSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // Limit abuse of the report button: 10 per day.
    const limit = rateLimit(`report:${user.id}`, 10, 24 * 60 * 60 * 1000);
    if (!limit.allowed) return fail("You have sent many reports today. Please wait for our team to review them.", 429);

    // You cannot report yourself.
    if (parsed.data.reportedUserId === user.id) {
      return fail("You cannot report your own account.", 400);
    }

    // Reporting an anonymous community post: the public UI never knows the
    // author, but moderation must - so we attach the stored authorId here.
    let reportedUserId = parsed.data.reportedUserId ?? null;
    if (parsed.data.communityPostId) {
      const post = await prisma.communityPost.findUnique({ where: { id: parsed.data.communityPostId } });
      if (!post) return fail("That post was not found.", 404);
      reportedUserId = post.authorId;
    }

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        type: parsed.data.type,
        details: parsed.data.details,
        status: "OPEN",
        lodgeId: parsed.data.lodgeId ?? null,
        marketItemId: parsed.data.marketItemId ?? null,
        gigId: parsed.data.gigId ?? null,
        communityPostId: parsed.data.communityPostId ?? null,
        reportedUserId,
      },
    });

    // A SCAM report on a listing immediately puts that listing under review,
    // which hides it from search until an admin decides. This is fast protection
    // for the next student.
    if (parsed.data.type === "SCAM" || parsed.data.type === "FAKE_LISTING") {
      if (parsed.data.lodgeId) {
        await prisma.lodge
          .update({ where: { id: parsed.data.lodgeId }, data: { status: "UNDER_REVIEW" } })
          .catch(() => null);
      }
      if (parsed.data.marketItemId) {
        await prisma.marketItem
          .update({ where: { id: parsed.data.marketItemId }, data: { status: "REMOVED" } })
          .catch(() => null);
      }
    }

    await notify({
      userId: user.id,
      title: "Report received",
      body: "Thank you. Our team will review this within 24 hours. If you have paid anyone, open a dispute as well.",
      link: "/profile",
    });

    return json({ id: report.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
