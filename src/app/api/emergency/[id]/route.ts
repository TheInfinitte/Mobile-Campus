/**
 * src/app/api/emergency/[id]/route.ts
 * WHAT: Reads one goodwill request and lets its author withdraw it.
 * WHY : A student who got help elsewhere, or who changed their mind, must be
 *       able to take their request down in one tap - and withdrawing carries
 *       no penalty of any kind.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getSessionUser } from "@/lib/auth";
import { fail, json, handleError } from "@/lib/api";
import { cancelRequest, revealFor } from "@/lib/goodwill";

type RouteContext = { params: { id: string } };

/**
 * GET /api/emergency/:requestId
 * WHAT: One request. The requester sees their own record; a helper who has
 *       already committed sees the revealed details; everyone else sees the
 *       anonymous card only.
 * WHY : Bank details are decrypted for exactly one audience - the helper
 *       holding a live commitment - never for a casual browser.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const viewer = await getSessionUser();

    const request = await prisma.goodwillRequest.findUnique({
      where: { id: context.params.id },
      select: {
        id: true,
        alias: true,
        story: true,
        amountKobo: true,
        status: true,
        requesterId: true,
        activeHelpId: true,
        createdAt: true,
        receivedAt: true,
        closedAt: true,
        helps: {
          select: {
            id: true,
            helperId: true,
            status: true,
            expiresAt: true,
            sentAt: true,
            confirmedAt: true,
            note: true,
          },
        },
      },
    });
    if (!request) return fail("That request is no longer on the board.", 404);

    const isRequester = viewer?.id === request.requesterId;
    // The viewer's own commitment on this request, if they have one.
    const myHelp = request.helps.find((help) => help.helperId === viewer?.id) ?? null;

    // Reveal only to a helper with a live commitment (COMMITTED or SENT).
    const reveal =
      myHelp && (myHelp.status === "COMMITTED" || myHelp.status === "SENT")
        ? await revealFor(viewer!.id, request.id)
        : null;

    return json({
      request: {
        ...request,
        // Strip the internal helper ids from the public shape.
        helps: request.helps.map((help) => ({
          id: help.id,
          status: help.status,
          expiresAt: help.expiresAt,
          sentAt: help.sentAt,
          confirmedAt: help.confirmedAt,
          note: help.note,
          isMine: help.helperId === viewer?.id,
        })),
        isRequester,
        myHelpId: myHelp?.id ?? null,
        reveal,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/emergency/:requestId
 * WHAT: The author withdraws their request.
 * WHY : Asking for help must never be a trap - leaving is always one tap and
 *       always free of consequence.
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    await cancelRequest(user.id, context.params.id);
    return json({ id: context.params.id, status: "CANCELLED" });
  } catch (error) {
    return handleError(error);
  }
}
