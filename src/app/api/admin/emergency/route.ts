/**
 * src/app/api/admin/emergency/route.ts
 * WHAT: Admin view of the goodwill board - every request with real
 *       identities, every commitment with its outcome, and the ban list.
 * WHY : Anonymity protects students from each other, never from moderation.
 *       Admins also review bans, because a 7-day pause should always be
 *       something a human can undo if the student was wrongly caught.
 *
 * There is deliberately no treasury, balance or fee endpoint here - the
 * platform never holds or moves anyone's money on this board.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { applyExpiredCommitments } from "@/lib/goodwill";

/**
 * GET /api/admin/emergency
 * Returns: the full request ledger, the commitment ledger (who unlocked what
 * and what happened next), and every goodwill record with an active pause.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();

    // Settle any expired commitments so the ledger an admin reads is current.
    await applyExpiredCommitments();

    const [requests, helps, banned] = await Promise.all([
      prisma.goodwillRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          requester: {
            select: { fullName: true, phone: true, isVerified: true, institution: { select: { shortName: true } } },
          },
          helps: { select: { id: true, status: true, committedAt: true, expiresAt: true, sentAt: true, confirmedAt: true } },
        },
      }),
      prisma.goodwillHelp.findMany({
        orderBy: { committedAt: "desc" },
        take: 100,
        include: {
          helper: { select: { fullName: true, phone: true } },
          request: { select: { alias: true } },
        },
      }),
      prisma.goodwillRecord.findMany({
        where: { boardBannedUntil: { gt: new Date() } },
        include: { user: { select: { fullName: true, phone: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return json({
      requests: requests.map((request) => ({
        id: request.id,
        alias: request.alias,
        story: request.story,
        amountKobo: request.amountKobo,
        status: request.status,
        createdAt: request.createdAt,
        receivedAt: request.receivedAt,
        closedAt: request.closedAt,
        requester: request.requester,
        commitments: request.helps.length,
      })),
      helps: helps.map((help) => ({
        id: help.id,
        alias: help.request.alias,
        status: help.status,
        committedAt: help.committedAt,
        expiresAt: help.expiresAt,
        sentAt: help.sentAt,
        confirmedAt: help.confirmedAt,
        helper: help.helper,
      })),
      bans: banned.map((record) => ({
        userId: record.userId,
        fullName: record.user.fullName,
        phone: record.user.phone,
        helpsCompleted: record.helpsCompleted,
        helpsAbandoned: record.helpsAbandoned,
        boardBannedUntil: record.boardBannedUntil,
        banReason: record.banReason,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
