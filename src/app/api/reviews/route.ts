/**
 * src/app/api/reviews/route.ts
 * WHAT: Creates a review of a lodge. Only a verified student who has actually
 *       paid for that lodge through escrow may write one.
 * WHY : Fake reviews destroy trust faster than anything else on a marketplace.
 *       Requiring a real transaction makes every review worth reading.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, createReviewSchema } from "@/lib/validators";

/**
 * POST /api/reviews
 * Body: { lodgeId, rating, safety?, cleanliness?, comment }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(createReviewSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // Must be a verified student (not a fresher, not the landlord).
    if (user.role !== "STUDENT") return fail("Only students can review a lodge.", 403);
    if (!user.isVerified) return fail("You need to be a verified student to write a review.", 403);

    // Limit to 3 reviews a day so nobody floods a competitor's listing.
    const limit = rateLimit(`review:${user.id}`, 3, 24 * 60 * 60 * 1000);
    if (!limit.allowed) return fail("You have written enough reviews for today.", 429);

    const lodge = await prisma.lodge.findUnique({ where: { id: parsed.data.lodgeId } });
    if (!lodge) return fail("That listing was not found.", 404);

    // You cannot review your own property.
    if (lodge.landlordId === user.id) return fail("You cannot review your own listing.", 400);

    // THE KEY CHECK: they must have a real escrow payment for this lodge.
    const tenancy = await prisma.escrowTransaction.findFirst({
      where: {
        payerId: user.id,
        lodgeId: lodge.id,
        type: "RENT",
        state: { in: ["HELD", "CONFIRMED", "RELEASED"] },
      },
    });
    if (!tenancy) {
      return fail("Only students who have rented this lodge through Mobile Campus can review it.", 403);
    }

    // One review per person per lodge (also enforced by a unique index).
    const existing = await prisma.review.findUnique({
      where: { lodgeId_userId: { lodgeId: lodge.id, userId: user.id } },
    });
    if (existing) return fail("You have already reviewed this lodge.", 409);

    const review = await prisma.review.create({
      data: {
        lodgeId: lodge.id,
        userId: user.id,
        rating: parsed.data.rating,
        safety: parsed.data.safety,
        cleanliness: parsed.data.cleanliness,
        comment: parsed.data.comment,
        isVerifiedTenant: true, // We just proved it above.
      },
    });

    // Recalculate the cached average so the listing shows the new rating
    // immediately, without a join on every page view.
    const aggregate = await prisma.review.aggregate({
      where: { lodgeId: lodge.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.lodge.update({
      where: { id: lodge.id },
      data: {
        ratingAverage: Number((aggregate._avg.rating ?? 0).toFixed(2)),
        ratingCount: aggregate._count.rating ?? 0,
      },
    });

    // Let the landlord know (they cannot delete it, but they should see it).
    await notify({
      userId: lodge.landlordId,
      title: "New review received",
      body: `${user.fullName.split(" ")[0]} left a ${parsed.data.rating}-star review on "${lodge.title}".`,
      link: "/landlord",
    });

    return json({ id: review.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
