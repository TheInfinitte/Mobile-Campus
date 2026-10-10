/**
 * src/app/api/errands/[id]/route.ts
 * WHAT: One errand - read it, claim it as a mover, mark it done, or cancel.
 * WHY : The claim flow is the heart of the errands board: a poster sets
 *       pickup/drop-off/fee, a moving student claims the task, and both sides
 *       get notified at every step. No food, no cart - just logistics.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getSessionUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, errandActionSchema } from "@/lib/validators";

type RouteContext = { params: { id: string } };

/**
 * GET /api/errands/:id
 * Full errand details. The poster's phone is only revealed once someone has
 * claimed the task - before that only the name shows, to limit spam.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const viewer = await getSessionUser();
    const errand = await prisma.errand.findUnique({
      where: { id: context.params.id },
      include: {
        poster: { select: { id: true, fullName: true, phone: true, isVerified: true, avatarUrl: true } },
        claimedBy: { select: { id: true, fullName: true, phone: true, avatarUrl: true } },
      },
    });
    if (!errand) return fail("That errand no longer exists.", 404);

    const iAmPoster = viewer?.id === errand.posterId;
    const iAmClaimer = viewer?.id === errand.claimedById;
    // Contact details unlock for the two people actually doing the handover.
    const contactsVisible = iAmPoster || iAmClaimer;

    return json({
      errand: {
        id: errand.id,
        title: errand.title,
        description: errand.description,
        category: errand.category,
        pickupPoint: errand.pickupPoint,
        dropOffPoint: errand.dropOffPoint,
        feeKobo: errand.feeKobo,
        isNegotiable: errand.isNegotiable,
        dueAt: errand.dueAt,
        status: errand.status,
        createdAt: errand.createdAt,
        iAmPoster,
        iAmClaimer,
        poster: {
          id: errand.poster.id,
          fullName: errand.poster.fullName,
          isVerified: errand.poster.isVerified,
          avatarUrl: errand.poster.avatarUrl,
          phone: contactsVisible ? errand.poster.phone : null,
        },
        claimedBy: errand.claimedBy
          ? {
              id: errand.claimedBy.id,
              fullName: errand.claimedBy.fullName,
              avatarUrl: errand.claimedBy.avatarUrl,
              phone: contactsVisible ? errand.claimedBy.phone : null,
            }
          : null,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/errands/:id
 * Body: { action: "CLAIM" | "COMPLETE" | "CANCEL" }
 * CLAIM    - any verified student (not the poster) takes the task.
 * COMPLETE - the poster confirms the handover happened.
 * CANCEL   - poster (or the claimer, releasing it) backs out.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(errandActionSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const errand = await prisma.errand.findUnique({ where: { id: context.params.id } });
    if (!errand) return fail("That errand no longer exists.", 404);
    // SILO: an errand can only be worked by students of its own campus.
    if (user.institutionId !== errand.institutionId) return fail("That errand belongs to another campus.", 403);

    const { action } = parsed.data;

    if (action === "CLAIM") {
      if (errand.posterId === user.id) return fail("You cannot claim your own errand.", 400);
      if (errand.status !== "OPEN") return fail("Someone has already claimed this errand.", 409);
      // Same trust rule as gigs: verified students only handle handovers.
      if (!user.isVerified) return fail("Verify your student status before claiming errands.", 403);

      const updated = await prisma.errand.update({
        where: { id: errand.id },
        data: { claimedById: user.id, claimedAt: new Date(), status: "CLAIMED" },
      });

      await notify({
        userId: errand.posterId,
        title: "Your errand has been claimed",
        body: `${user.fullName} will pick up from ${errand.pickupPoint} and deliver to ${errand.dropOffPoint}. Their contact details are now visible on the task.`,
        link: `/errands/${errand.id}`,
        sms: true,
        smsBody: `${user.fullName} claimed your errand "${errand.title}" on Mobile Campus.`,
      });

      return json({ id: updated.id, status: updated.status });
    }

    if (action === "COMPLETE") {
      // Only the poster can confirm - they are the one receiving the item.
      if (errand.posterId !== user.id) return fail("Only the poster can confirm completion.", 403);
      if (errand.status !== "CLAIMED") return fail("Only a claimed errand can be completed.", 409);

      const updated = await prisma.errand.update({ where: { id: errand.id }, data: { status: "COMPLETED" } });

      if (errand.claimedById) {
        await notify({
          userId: errand.claimedById,
          title: "Errand completed - thank you!",
          body: `The poster confirmed "${errand.title}" was delivered. Settle the ₦${(errand.feeKobo / 100).toLocaleString("en-NG")} fee with them directly.`,
          link: `/errands/${errand.id}`,
        });
      }

      return json({ id: updated.id, status: updated.status });
    }

    // CANCEL - poster backs out, or the claimer releases it back to the board.
    const isPoster = errand.posterId === user.id;
    const isClaimer = errand.claimedById === user.id;
    if (!isPoster && !isClaimer) return fail("Only the poster or the claimer can cancel.", 403);
    if (errand.status === "COMPLETED") return fail("A completed errand cannot be cancelled.", 409);

    if (isClaimer && !isPoster) {
      // The mover releases the task so someone else can claim it.
      const released = await prisma.errand.update({
        where: { id: errand.id },
        data: { status: "OPEN", claimedById: null, claimedAt: null },
      });
      await notify({
        userId: errand.posterId,
        title: "Your errand was released",
        body: `${user.fullName} could not complete "${errand.title}". It is back on the board for someone else.`,
        link: `/errands/${errand.id}`,
      });
      return json({ id: released.id, status: released.status });
    }

    const cancelled = await prisma.errand.update({ where: { id: errand.id }, data: { status: "CANCELLED" } });
    if (errand.claimedById) {
      await notify({
        userId: errand.claimedById,
        title: "Errand cancelled by the poster",
        body: `"${errand.title}" was cancelled. No delivery needed.`,
        link: `/errands/${errand.id}`,
      });
    }
    return json({ id: cancelled.id, status: cancelled.status });
  } catch (error) {
    return handleError(error);
  }
}
