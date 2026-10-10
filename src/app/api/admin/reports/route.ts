/**
 * src/app/api/admin/reports/route.ts
 * WHAT: The scam-report queue for admins.
 * WHY : Reports are how the community protects itself. An admin needs them
 *       grouped, newest first, with a direct link to the thing being reported.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

/**
 * GET /api/admin/reports?status=OPEN&type=SCAM
 * Admin only.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "OPEN";
    const type = url.searchParams.get("type");

    const reports = await prisma.report.findMany({
      where: {
        ...(status !== "ALL" ? { status: status as "OPEN" } : {}),
        ...(type ? { type: type as "SCAM" } : {}),
      },
      include: {
        reporter: { select: { id: true, fullName: true, phone: true } },
        reportedUser: { select: { id: true, fullName: true, phone: true } },
        lodge: { select: { id: true, title: true } },
        marketItem: { select: { id: true, title: true } },
        gig: { select: { id: true, title: true } },
        communityPost: { select: { id: true, isAnonymous: true, alias: true, author: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Build a human label and a link for each report so the queue is one tap away.
    const shaped = reports.map((report) => {
      if (report.lodge) {
        return { subjectLabel: `the lodge "${report.lodge.title}"`, subjectHref: `/housing/${report.lodge.id}` };
      }
      if (report.marketItem) {
        return { subjectLabel: `the item "${report.marketItem.title}"`, subjectHref: `/market/${report.marketItem.id}` };
      }
      if (report.gig) {
        return { subjectLabel: `the task "${report.gig.title}"`, subjectHref: `/gigs/${report.gig.id}` };
      }
      if (report.communityPost) {
        // Moderation sees the TRUE author behind anonymous posts.
        const who = report.communityPost.isAnonymous
          ? `${report.communityPost.alias} (real name: ${report.communityPost.author.fullName})`
          : report.communityPost.author.fullName;
        return { subjectLabel: `a community post by ${who}`, subjectHref: `/community/${report.communityPost.id}` };
      }
      if (report.reportedUser) {
        return { subjectLabel: `the user ${report.reportedUser.fullName}`, subjectHref: null };
      }
      return { subjectLabel: "this content", subjectHref: null };
    });

    return json({
      reports: reports.map((report, index) => ({
        id: report.id,
        type: report.type,
        status: report.status,
        details: report.details,
        adminNote: report.adminNote,
        createdAt: report.createdAt,
        reporter: report.reporter,
        reportedUser: report.reportedUser,
        ...shaped[index],
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
