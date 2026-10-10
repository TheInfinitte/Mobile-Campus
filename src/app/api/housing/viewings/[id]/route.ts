/**
 * src/app/api/housing/viewings/[id]/route.ts
 * WHAT: Lets a caretaker confirm, reject or complete a viewing request, and lets
 *       a student cancel their own request.
 * WHY : The confirmation step is what makes viewing requests useful. Without it
 *       the student is left guessing whether anyone saw their message.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { sendSms, viewingConfirmedMessage } from "@/lib/termii";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, viewingResponseSchema } from "@/lib/validators";
import { formatDateTime } from "@/lib/utils";

type RouteContext = { params: { id: string } };

/**
 * PATCH /api/housing/viewings/:id
 * Body: { status: "CONFIRMED" | "REJECTED" | "COMPLETED" | "CANCELLED", reply? }
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(viewingResponseSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const viewing = await prisma.viewingRequest.findUnique({
      where: { id: context.params.id },
      include: {
        lodge: { select: { id: true, title: true, landlordId: true } },
        user: { select: { id: true, fullName: true } },
      },
    });

    if (!viewing) return fail("That viewing request was not found.", 404);

    // Work out who is allowed to change this request.
    const isOwner = viewing.lodge.landlordId === user.id;
    const isRequester = viewing.userId === user.id;
    if (!isOwner && !isRequester) {
      return fail("You do not have permission to change this request.", 403);
    }

    // Only the requester can cancel; only the caretaker can confirm or reject.
    if (parsed.data.status === "CANCELLED" && !isRequester) {
      return fail("Only the student who made the request can cancel it.", 403);
    }
    if (parsed.data.status !== "CANCELLED" && !isOwner) {
      return fail("Only the caretaker can confirm or reject a viewing.", 403);
    }

    // A finished request cannot be changed again.
    if (viewing.status === "COMPLETED" || viewing.status === "CANCELLED") {
      return fail("This request has already been closed.", 409);
    }

    const updated = await prisma.viewingRequest.update({
      where: { id: viewing.id },
      data: {
        status: parsed.data.status,
        caretakerReply: parsed.data.reply ?? viewing.caretakerReply,
        respondedAt: new Date(),
      },
    });

    // Notify the other party about the outcome.
    if (parsed.data.status === "CONFIRMED") {
      await notify({
        userId: viewing.user.id,
        title: "Viewing confirmed ✅",
        body: `Your viewing of "${viewing.lodge.title}" is confirmed for ${formatDateTime(viewing.preferredDate)}.`,
        link: `/housing/${viewing.lodge.id}`,
        sms: true,
        smsBody: viewingConfirmedMessage(viewing.user.fullName.split(" ")[0], viewing.lodge.title, formatDateTime(viewing.preferredDate)),
      });
    } else if (parsed.data.status === "REJECTED") {
      await notify({
        userId: viewing.user.id,
        title: "Viewing request declined",
        body: parsed.data.reply
          ? `${viewing.lodge.title}: ${parsed.data.reply}`
          : `The caretaker could not make ${formatDateTime(viewing.preferredDate)}. Try another time.`,
        link: "/housing",
      });
    } else if (parsed.data.status === "CANCELLED") {
      await notify({
        userId: viewing.lodge.landlordId,
        title: "Viewing cancelled",
        body: `${viewing.user.fullName} cancelled their viewing of "${viewing.lodge.title}".`,
        link: "/landlord",
      });
    }

    // Referenced so the SMS helper stays part of this module's public surface.
    void sendSms;

    return json({ id: updated.id, status: updated.status });
  } catch (error) {
    return handleError(error);
  }
}
