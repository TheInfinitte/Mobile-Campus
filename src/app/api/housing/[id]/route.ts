/**
 * src/app/api/housing/[id]/route.ts
 * WHAT: Returns the full detail of one lodge, including all photos, reviews and
 *       the caretaker's contact details.
 * WHY : The listing page needs everything at once so it can render without extra
 *       requests - important when data is slow and expensive.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUser } from "@/lib/auth";
import { housingFeeBreakdown } from "@/lib/fees";
import { json, fail, handleError, readJson } from "@/lib/api";
import { safeParse, createLodgeSchema, imageListSchema } from "@/lib/validators";
import { z } from "zod";

type RouteContext = { params: { id: string } };

/**
 * GET /api/housing/:id
 * Returns the lodge, its images, its reviews and the fee for booking it.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const id = context.params.id;

    const lodge = await prisma.lodge.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        // Newest reviews first, limited so the page stays fast.
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { fullName: true, level: true, avatarUrl: true, isVerified: true } },
          },
        },
        landlord: {
          // Never return the password hash or encrypted fields.
          select: { id: true, fullName: true, phone: true, isVerified: true, avatarUrl: true, createdAt: true, landlordType: true, principalName: true },
        },
      },
    });

    if (!lodge) return fail("That listing no longer exists.", 404);
    // A listing removed by an admin must not be reachable by its direct link.
    if (lodge.status === "REMOVED") return fail("That listing has been removed.", 410);

    // The real 1% tenant commission for THIS price, not an estimate.
    const fees = await housingFeeBreakdown(lodge.annualRentKobo);

    // Has the signed-in user shortlisted this lodge? (used to fill the heart)
    const viewer = await getSessionUser();
    const shortlisted = viewer
      ? Boolean(
          await prisma.shortlist.findFirst({ where: { userId: viewer.id, lodgeId: lodge.id } })
        )
      : false;

    // Has the viewer rented here before? Only they may review.
    const hasRented = viewer
      ? Boolean(
          await prisma.escrowTransaction.findFirst({
            where: { payerId: viewer.id, lodgeId: lodge.id, state: { in: ["HELD", "CONFIRMED", "RELEASED"] } },
          })
        )
      : false;

    return json({
      lodge: {
        id: lodge.id,
        title: lodge.title,
        description: lodge.description,
        area: lodge.area,
        address: lodge.address,
        city: lodge.city,
        state: lodge.state,
        monthlyRentKobo: lodge.monthlyRentKobo,
        annualRentKobo: lodge.annualRentKobo,
        cautionDepositKobo: lodge.cautionDepositKobo,
        roomType: lodge.roomType,
        waterSource: lodge.waterSource,
        waterNote: lodge.waterNote,
        meterType: lodge.meterType,
        lightNote: lodge.lightNote,
        distanceToMainGateMeters: lodge.distanceToMainGateMeters,
        distanceToFacultyMeters: lodge.distanceToFacultyMeters,
        distanceToMarketMeters: lodge.distanceToMarketMeters,
        amenities: lodge.amenities,
        availableRooms: lodge.availableRooms,
        maxOccupancy: lodge.maxOccupancy,
        caretakerName: lodge.caretakerName,
        caretakerPhone: lodge.caretakerPhone,
        isVerified: lodge.isVerified,
        status: lodge.status,
        ratingAverage: lodge.ratingAverage,
        ratingCount: lodge.ratingCount,
        createdAt: lodge.createdAt,
        images: lodge.images.map((image) => ({ url: image.url, altText: image.altText, isCover: image.isCover })),
        reviews: lodge.reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          safety: review.safety,
          cleanliness: review.cleanliness,
          comment: review.comment,
          isVerifiedTenant: review.isVerifiedTenant,
          createdAt: review.createdAt,
          author: review.user,
        })),
        landlord: lodge.landlord,
        // Fee maths for the booking sheet.
        feeKobo: fees.payerFeeKobo,
        landlordFeeKobo: fees.payeeFeeKobo,
        feeLines: fees.lines,
        totalMoveInKobo: lodge.annualRentKobo + lodge.cautionDepositKobo + fees.payerFeeKobo,
      },
      shortlisted,
      hasRented,
    });
  } catch (error) {
    return handleError(error);
  }
}

/** The fields a landlord is allowed to change after a listing is live. */
const updateLodgeSchema = createLodgeSchema
  .omit({ images: true })
  .partial()
  .extend({
    // Status changes are separate from content edits, and only these two are
    // allowed: a landlord cannot un-report their own listing.
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    // Adding photos without resending the whole listing.
    newImages: imageListSchema.optional(),
  });

/**
 * PATCH /api/housing/:id
 * WHAT: Updates a listing, but only for the landlord who owns it.
 * WHY : Landlords change rents and availability weekly. Everything is validated
 *       server-side again, because a client can send anything it likes.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(updateLodgeSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const lodge = await prisma.lodge.findUnique({ where: { id: context.params.id } });
    if (!lodge) return fail("That listing no longer exists.", 404);

    // Ownership check - an admin may edit anything, a landlord only their own.
    if (lodge.landlordId !== user.id && user.role !== "ADMIN") {
      return fail("You can only edit your own listings.", 403);
    }

    // A removed listing stays removed - only an admin can bring it back.
    if (lodge.status === "REMOVED" && user.role !== "ADMIN") {
      return fail("That listing was removed by our team. Contact support to discuss it.", 410);
    }

    const { newImages, ...fields } = parsed.data;

    // Append any new photos, keeping the existing order intact.
    if (newImages && newImages.length > 0) {
      const highest = await prisma.lodgeImage.aggregate({ where: { lodgeId: lodge.id }, _max: { sortOrder: true } });
      let order = (highest._max.sortOrder ?? -1) + 1;
      for (const url of newImages) {
        await prisma.lodgeImage.create({ data: { lodgeId: lodge.id, url, sortOrder: order++ } });
      }
    }

    const updated = await prisma.lodge.update({
      where: { id: lodge.id },
      // `undefined` values are ignored by Prisma, so a partial update is safe.
      data: { ...fields },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    return json({ id: updated.id, status: updated.status, monthlyRentKobo: updated.monthlyRentKobo, imageCount: updated.images.length });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/housing/:id
 * WHAT: Marks a listing as removed and hides it from search.
 * WHY : A soft delete keeps the row (and its reviews and payment history) intact
 *       so a completed escrow can still point at something meaningful.
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const lodge = await prisma.lodge.findUnique({ where: { id: context.params.id } });
    if (!lodge) return fail("That listing no longer exists.", 404);
    if (lodge.landlordId !== user.id && user.role !== "ADMIN") {
      return fail("You can only remove your own listings.", 403);
    }

    // Money still moving means we cannot hide the listing yet.
    const liveEscrow = await prisma.escrowTransaction.count({
      where: { lodgeId: lodge.id, state: { in: ["PENDING_PAYMENT", "HELD", "CONFIRMED", "DISPUTED"] } },
    });
    if (liveEscrow > 0) {
      return fail("There is still an active payment on this listing. Set it to inactive instead.", 409);
    }

    await prisma.lodge.update({ where: { id: lodge.id }, data: { status: "REMOVED" } });
    return json({ id: lodge.id, status: "REMOVED" });
  } catch (error) {
    return handleError(error);
  }
}
