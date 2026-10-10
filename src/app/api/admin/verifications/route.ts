/**
 * src/app/api/admin/verifications/route.ts
 * WHAT: The verification queue - lists uploaded student ID cards, JAMB admission
 *       letters and landlord documents for review.
 * WHY : This is where trust on the platform is created. The list is ordered
 *       oldest-first so nobody waits too long.
 *
 * PRIVACY: Encrypted identifier columns are NEVER selected. Admins see only the
 * last four characters, which is enough to match a document against a list.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

/**
 * GET /api/admin/verifications?status=PENDING&type=STUDENT_ID
 * Admin only.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "PENDING";
    const type = url.searchParams.get("type");

    const records = await prisma.verificationRecord.findMany({
      where: {
        ...(status !== "ALL" ? { status: status as "PENDING" } : {}),
        ...(type ? { type: type as "STUDENT_ID" } : {}),
      },
      // Explicit select: this is how we guarantee encrypted fields never leak.
      select: {
        id: true,
        type: true,
        status: true,
        identifierLast4: true,
        documentUrls: true,
        adminNote: true,
        submittedAt: true,
        reviewedAt: true,
        user: { select: { id: true, fullName: true, phone: true, avatarUrl: true, role: true, createdAt: true } },
      },
      // Oldest first - first come, first served.
      orderBy: { submittedAt: "asc" },
      take: 100,
    });

    // Count per status so the tabs can show badges.
    const counts = await prisma.verificationRecord.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return json({
      records,
      counts: counts.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
      }, {}),
    });
  } catch (error) {
    return handleError(error);
  }
}
