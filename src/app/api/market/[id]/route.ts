/**
 * src/app/api/market/[id]/route.ts
 * WHAT: Returns one market item in full, and lets the seller update or remove it.
 * WHY : The item page needs photos, seller details and the escrow fee in one
 *       request so the buyer sees the true total before paying.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { escrowFeeBreakdown } from "@/lib/fees";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, createMarketItemSchema } from "@/lib/validators";

type RouteContext = { params: { id: string } };

/**
 * GET /api/market/:id
 * Returns the item, the seller, and the fee breakdown for buying it.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const item = await prisma.marketItem.findUnique({
      where: { id: context.params.id },
      include: {
        seller: {
          // Never return the password hash.
          select: { id: true, fullName: true, phone: true, isVerified: true, avatarUrl: true, level: true, createdAt: true },
        },
      },
    });

    if (!item) return fail("That item is no longer available.", 404);

    // Count the view so sellers can see interest. Fire-and-forget: we do not want
    // a failed counter update to break the page.
    void prisma.marketItem.update({ where: { id: item.id }, data: { views: { increment: 1 } } }).catch(() => null);

    // The real 3% escrow fee for THIS price.
    const fees = await escrowFeeBreakdown(item.priceKobo);

    const viewer = await getSessionUser();
    const shortlisted = viewer
      ? Boolean(await prisma.shortlist.findFirst({ where: { userId: viewer.id, marketItemId: item.id } }))
      : false;

    return json({
      item: {
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        priceKobo: item.priceKobo,
        negotiableMinKobo: item.negotiableMinKobo,
        condition: item.condition,
        area: item.area,
        pickupNote: item.pickupNote,
        images: item.images,
        isGraduatingDrop: item.isGraduatingDrop,
        status: item.status,
        views: item.views,
        createdAt: item.createdAt,
        seller: item.seller,
        feeKobo: fees.payerFeeKobo,
        feeLines: fees.lines,
        // What the buyer pays in total: price + our fee.
        totalKobo: item.priceKobo + fees.payerFeeKobo,
        // What the seller receives: price minus their share of the fee.
        sellerReceivesKobo: item.priceKobo - fees.payeeFeeKobo,
      },
      shortlisted,
      isMine: viewer?.id === item.sellerId,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/market/:id
 * Body: the same shape as creating an item.
 * Only the seller may edit, and only while it is still available.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);

    const body = await readJson(request);
    const parsed = safeParse(createMarketItemSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const item = await prisma.marketItem.findUnique({ where: { id: context.params.id } });
    if (!item) return fail("That item was not found.", 404);
    if (item.sellerId !== user.id && user.role !== "ADMIN") {
      return fail("Only the seller can edit this listing.", 403);
    }

    const updated = await prisma.marketItem.update({
      where: { id: item.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        priceKobo: parsed.data.priceKobo,
        negotiableMinKobo: parsed.data.negotiableMinKobo ?? null,
        condition: parsed.data.condition,
        area: parsed.data.area,
        pickupNote: parsed.data.pickupNote,
        images: parsed.data.images,
      },
    });

    return json({ id: updated.id });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/market/:id
 * Marks the item as REMOVED rather than deleting it, so past escrow records still
 * point at something.
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in.", 401);

    const item = await prisma.marketItem.findUnique({ where: { id: context.params.id } });
    if (!item) return fail("That item was not found.", 404);
    if (item.sellerId !== user.id && user.role !== "ADMIN") {
      return fail("Only the seller can remove this listing.", 403);
    }

    // An item with money held in escrow cannot be removed.
    const activeEscrow = await prisma.escrowTransaction.findFirst({
      where: { marketItemId: item.id, state: { in: ["PENDING_PAYMENT", "HELD", "CONFIRMED"] } },
    });
    if (activeEscrow) {
      return fail("This item has an active payment. Resolve it before removing the listing.", 409);
    }

    await prisma.marketItem.update({ where: { id: item.id }, data: { status: "REMOVED" } });
    return json({ removed: true });
  } catch (error) {
    return handleError(error);
  }
}
