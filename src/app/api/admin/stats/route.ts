/**
 * src/app/api/admin/stats/route.ts
 * WHAT: The numbers at the top of the admin dashboard: queue sizes, revenue and
 *       platform totals.
 * WHY : An admin opens the dashboard to answer one question - "what needs my
 *       attention, and how much have we earned?" This endpoint answers both in
 *       one request.
 *
 * Revenue maths (all in kobo):
 *   earned  = fees on every RELEASED escrow (money we actually kept)
 *   held    = total held in escrow right now (money we are responsible for)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

/**
 * GET /api/admin/stats
 * Admin only.
 */
export async function GET(): Promise<NextResponse> {
  try {
    // requireRole throws a 403 for anyone who is not an admin.
    await requireAdmin();

    // Run every count in parallel - the dashboard loads much faster.
    const [
      pendingVerifications,
      openDisputes,
      openReports,
      activeLodges,
      totalUsers,
      verifiedUsers,
      provisionalUsers,
      availableItems,
      openGigs,
      releasedAggregate,
      heldAggregate,
      refundedAggregate,
    ] = await Promise.all([
      prisma.verificationRecord.count({ where: { status: "PENDING" } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.report.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
      prisma.lodge.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.user.count({ where: { verificationStatus: "VERIFIED" } }),
      prisma.user.count({ where: { verificationStatus: "PROVISIONAL" } }),
      prisma.marketItem.count({ where: { status: "AVAILABLE" } }),
      prisma.gig.count({ where: { status: "OPEN" } }),
      // Revenue = the fees on deals we completed.
      prisma.escrowTransaction.aggregate({
        where: { state: "RELEASED" },
        _sum: { feeKobo: true, totalKobo: true },
        _count: { id: true },
      }),
      // Money currently in our care.
      prisma.escrowTransaction.aggregate({
        where: { state: { in: ["HELD", "CONFIRMED", "DISPUTED"] } },
        _sum: { totalKobo: true },
        _count: { id: true },
      }),
      prisma.escrowTransaction.aggregate({
        where: { state: "REFUNDED" },
        _sum: { totalKobo: true },
        _count: { id: true },
      }),
    ]);

    return json({
      queue: { pendingVerifications, openDisputes, openReports },
      platform: {
        totalUsers,
        verifiedUsers,
        provisionalUsers,
        activeLodges,
        availableItems,
        openGigs,
      },
      revenue: {
        // The fee income we actually earned.
        earnedKobo: releasedAggregate._sum.feeKobo ?? 0,
        // Total value of deals we completed (useful context).
        volumeKobo: releasedAggregate._sum.totalKobo ?? 0,
        releasedCount: releasedAggregate._count.id ?? 0,
        heldKobo: heldAggregate._sum.totalKobo ?? 0,
        heldCount: heldAggregate._count.id ?? 0,
        refundedKobo: refundedAggregate._sum.totalKobo ?? 0,
        refundedCount: refundedAggregate._count.id ?? 0,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
