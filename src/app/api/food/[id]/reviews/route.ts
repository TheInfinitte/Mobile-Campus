/**
 * src/app/api/food/[id]/reviews/route.ts
 * WHAT: Reads and writes star reviews for one food spot.
 * WHY : "User suggestions/reviews" on the card are what make the directory
 *       trustworthy - a spot rated by real students beats any ad.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, foodReviewSchema } from "@/lib/validators";

type RouteContext = { params: { id: string } };

/**
 * GET /api/food/:id/reviews
 * All reviews for one spot, newest first, with the reviewer's first name.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const reviews = await prisma.foodReview.findMany({
      where: { vendorId: context.params.id, vendor: { status: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true, avatarUrl: true } } },
    });
    return json({ reviews });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/food/:id/reviews
 * Body: { rating: 1-5, comment }
 * One review per student per spot - posting again updates the old one.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only students can review food spots.", 403);
    // Same trust rule as everywhere else: verified students only.
    if (!user.isVerified) return fail("Verify your student status before reviewing.", 403);

    const vendor = await prisma.foodVendor.findUnique({ where: { id: context.params.id } });
    if (!vendor || vendor.status !== "ACTIVE") return fail("That food spot is not on the directory.", 404);
    // SILO: review spots at your own campus only.
    if (vendor.institutionId !== user.institutionId) return fail("You can only review spots at your own campus.", 403);

    const body = await readJson(request);
    const parsed = safeParse(foodReviewSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // upsert = first review inserts, a second review by the same student
    // replaces the first one instead of stacking duplicates.
    const review = await prisma.foodReview.upsert({
      where: { vendorId_userId: { vendorId: vendor.id, userId: user.id } },
      create: { vendorId: vendor.id, userId: user.id, rating: parsed.data.rating, comment: parsed.data.comment },
      update: { rating: parsed.data.rating, comment: parsed.data.comment },
    });

    return json({ id: review.id, rating: review.rating }, 201);
  } catch (error) {
    return handleError(error);
  }
}
