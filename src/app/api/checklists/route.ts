/**
 * src/app/api/checklists/route.ts
 * WHAT: Saves a move-in or move-out condition checklist, and lists the checklists
 *       for a lodge.
 * WHY : A timestamped, signed record of the room's condition is what stops a
 *       caution-deposit argument. Both parties tick the same list.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, checklistSchema } from "@/lib/validators";

/**
 * GET /api/checklists?lodgeId=...
 * Returns the checklists for one lodge.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const lodgeId = new URL(request.url).searchParams.get("lodgeId");
    if (!lodgeId) return fail("Please provide a lodge id.", 400);

    // A user may only see checklists for a lodge they rented or they own.
    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge) return fail("That listing was not found.", 404);

    const involved =
      lodge.landlordId === user.id ||
      Boolean(
        await prisma.escrowTransaction.findFirst({
          where: { payerId: user.id, lodgeId: lodge.id },
        })
      );
    if (!involved && user.role !== "ADMIN") {
      return fail("You do not have access to these records.", 403);
    }

    const checklists = await prisma.conditionChecklist.findMany({
      where: { lodgeId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true, avatarUrl: true } } },
    });

    return json({ checklists });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/checklists
 * Body: { lodgeId, escrowId?, phase, items, photoUrls, signed }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(checklistSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const lodge = await prisma.lodge.findUnique({ where: { id: parsed.data.lodgeId } });
    if (!lodge) return fail("That listing was not found.", 404);

    // Only the tenant or the landlord of this lodge may create a record.
    const isLandlord = lodge.landlordId === user.id;
    const isTenant = Boolean(
      parsed.data.escrowId &&
        (await prisma.escrowTransaction.findFirst({
          where: { id: parsed.data.escrowId, payerId: user.id, lodgeId: lodge.id },
        }))
    );
    if (!isLandlord && !isTenant) {
      return fail("Only the tenant or the landlord can record the room condition.", 403);
    }

    // Store the item list as JSON text - the shape is small and always read whole.
    const checklist = await prisma.conditionChecklist.create({
      data: {
        lodgeId: lodge.id,
        escrowId: parsed.data.escrowId ?? null,
        userId: user.id,
        phase: parsed.data.phase,
        itemsJson: JSON.stringify(parsed.data.items),
        photoUrls: parsed.data.photoUrls,
        signedByTenant: parsed.data.signed && !isLandlord,
        signedByLandlord: parsed.data.signed && isLandlord,
      },
    });

    // Notify the other party that a record exists.
    const otherUserId = isLandlord ? (await prisma.escrowTransaction.findFirst({ where: { id: parsed.data.escrowId ?? "" } }))?.payerId : lodge.landlordId;
    if (otherUserId) {
      await notify({
        userId: otherUserId,
        title: parsed.data.phase === "MOVE_IN" ? "Move-in condition recorded" : "Move-out condition recorded",
        body: `${user.fullName.split(" ")[0]} saved the ${parsed.data.phase === "MOVE_IN" ? "move-in" : "move-out"} condition for ${lodge.title}. Review it and add your own record.`,
        link: `/housing/${lodge.id}`,
      });
    }

    return json({ id: checklist.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
