/**
 * src/app/api/emergency/board/route.ts
 * WHAT: The anonymous support board - open requests from the viewer's campus,
 *       shown as alias + story + amount only.
 * WHY : Dignity first. A student asking for help is never named to the people
 *       browsing. Identity and bank details are not merely hidden by the UI -
 *       they are not selected by this query at all, so nothing can leak.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { applyExpiredCommitments, banUntil, getRecord } from "@/lib/goodwill";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/emergency/board
 * Returns: open requests (alias/story/amount), plus the viewer's own active
 * commitments so the UI can show a live transfer timer.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const viewer = await getSessionUser();
    const institution = await getViewerInstitution();

    // Settle expired commitments first so the board never advertises a request
    // that is actually sitting with a silent helper.
    if (viewer) await applyExpiredCommitments(viewer.id);

    const [requests, record, myHelps] = await Promise.all([
      prisma.goodwillRequest.findMany({
        where: { institutionId: institution.id, status: "OPEN" },
        orderBy: { createdAt: "asc" }, // Longest-waiting student is seen first.
        select: {
          // Deliberately no requester relation, no bank fields, no phone.
          id: true,
          alias: true,
          story: true,
          amountKobo: true,
          createdAt: true,
          requesterId: true,
        },
      }),
      viewer ? getRecord(viewer.id) : null,
      viewer
        ? prisma.goodwillHelp.findMany({
            where: { helperId: viewer.id, status: { in: ["COMMITTED", "SENT"] } },
            select: {
              id: true,
              requestId: true,
              status: true,
              expiresAt: true,
              sentAt: true,
              request: { select: { alias: true, story: true, amountKobo: true, bankName: true } },
            },
          })
        : [],
    ]);

    return json({
      requests: requests.map((request) => ({
        id: request.id,
        alias: request.alias,
        story: request.story,
        amountKobo: request.amountKobo,
        createdAt: request.createdAt,
        isMine: viewer?.id === request.requesterId,
      })),
      // The UI needs these to lock the button and show the pause honestly.
      myCommitments: myHelps,
      boardBannedUntil: banUntil(record),
    });
  } catch (error) {
    return handleError(error);
  }
}
