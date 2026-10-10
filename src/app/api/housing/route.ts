/**
 * src/app/api/housing/route.ts
 * WHAT: Lists lodges with search and filters, and lets a verified landlord create
 *       a new listing.
 * WHY : This is the busiest endpoint in the app. It has to be fast (indexed
 *       queries, small page size) and it has to respect the filters the UI and
 *       the AI assistant both produce.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { lodgeWhere, lodgeOrderBy, paginate, PAGE_SIZE } from "@/lib/search";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, lodgeFilterSchema, createLodgeSchema } from "@/lib/validators";
import { housingFeeBreakdown } from "@/lib/fees";
import { isAllowedImage } from "@/lib/cloudinary";
import { areaBlurb } from "@/lib/data";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/housing?area=Ekrejeta&maxRentKobo=5000000&sort=price-asc
 * Returns: { data: { lodges, total, page, pageSize } }
 *
 * Public: anyone can browse. That is deliberate - a fresher without an account
 * should still see what is available.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Parse the query string with the same schema the AI assistant uses.
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = safeParse(lodgeFilterSchema, params);
    if (!parsed.ok) return fail(parsed.error, 400);

    const filter = parsed.data;
    const { skip, take } = paginate(filter.page, PAGE_SIZE);

    // MULTI-CAMPUS SILO: browse within the viewer's own institution (guests
    // get the platform default campus).
    const institution = await getViewerInstitution();

    // Run the count and the page query together so the UI can show pagination.
    const [total, rows] = await Promise.all([
      prisma.lodge.count({ where: lodgeWhere(filter, institution.id) }),
      prisma.lodge.findMany({
        where: lodgeWhere(filter, institution.id),
        orderBy: lodgeOrderBy(filter.sort),
        skip,
        take,
        include: {
          // Only the cover image, to keep the response small on mobile data.
          images: { where: { isCover: true }, take: 1 },
          landlord: { select: { id: true, fullName: true, isVerified: true, phone: true, landlordType: true, principalName: true } },
        },
      }),
    ]);

    // Calculate the tenant fee once so every card can show the true move-in cost.
    const feeRules = await housingFeeBreakdown(100_000);
    const feeRatio = feeRules.payerFeeKobo / 100_000;

    const lodges = rows.map((lodge) => {
      const feeKobo = Math.max(50_000, Math.round(lodge.annualRentKobo * feeRatio)); // Minimum ₦500.
      return {
        id: lodge.id,
        title: lodge.title,
        area: lodge.area,
        areaBlurb: areaBlurb(lodge.area),
        roomType: lodge.roomType,
        monthlyRentKobo: lodge.monthlyRentKobo,
        annualRentKobo: lodge.annualRentKobo,
        cautionDepositKobo: lodge.cautionDepositKobo,
        waterSource: lodge.waterSource,
        waterNote: lodge.waterNote,
        meterType: lodge.meterType,
        lightNote: lodge.lightNote,
        distanceToMainGateMeters: lodge.distanceToMainGateMeters,
        distanceToFacultyMeters: lodge.distanceToFacultyMeters,
        amenities: lodge.amenities,
        availableRooms: lodge.availableRooms,
        ratingAverage: lodge.ratingAverage,
        ratingCount: lodge.ratingCount,
        isVerified: lodge.isVerified,
        coverImage: lodge.images[0]?.url ?? null,
        // Pre-calculated so the UI never has to guess the fee.
        feeKobo,
        totalMoveInKobo: lodge.annualRentKobo + lodge.cautionDepositKobo + feeKobo,
        landlord: lodge.landlord,
        // Transparency badge data: an agent lists on behalf of the real owner.
        managedByAgent: lodge.landlord.landlordType === "AGENT",
        principalName: lodge.landlord.principalName,
        createdAt: lodge.createdAt,
      };
    });

    return json({ lodges, total, page: filter.page, pageSize: take });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/housing
 * Body: a full lodge object (see createLodgeSchema).
 * Returns: { data: { id } }
 *
 * Only a VERIFIED landlord may create a listing. This is the rule that keeps
 * fake listings off the platform.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Please sign in to list a lodge.", 401);
    if (user.role !== "LANDLORD") return fail("Only landlord accounts can create listings.", 403);
    if (!user.isVerified) {
      return fail("Upload your ownership document and wait for approval before listing.", 403);
    }

    const body = await readJson(request);
    const parsed = safeParse(createLodgeSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    if (!parsed.data.images.every(isAllowedImage)) {
      return fail("Please upload the photos again - one of the image links is not valid.", 400);
    }

    // Sanity check: the annual rent should not be lower than the monthly rent.
    if (parsed.data.annualRentKobo > 0 && parsed.data.annualRentKobo < parsed.data.monthlyRentKobo) {
      return fail("The yearly rent cannot be less than the monthly rent.", 400);
    }

    const [firstImage, ...restImages] = parsed.data.images;

    // The listing lives in the landlord's own institution silo.
    const institution = await prisma.institution.findUnique({ where: { id: user.institutionId } });
    if (!institution) return fail("Your institution is no longer active.", 400);

    const lodge = await prisma.lodge.create({
      data: {
        landlordId: user.id,
        institutionId: institution.id,
        city: institution.city,
        state: institution.state,
        title: parsed.data.title,
        description: parsed.data.description,
        area: parsed.data.area,
        address: parsed.data.address,
        monthlyRentKobo: parsed.data.monthlyRentKobo,
        // If the landlord did not set a yearly price, assume 11 months
        // (the common Nigerian practice of one month free on annual payment).
        annualRentKobo: parsed.data.annualRentKobo || parsed.data.monthlyRentKobo * 11,
        cautionDepositKobo: parsed.data.cautionDepositKobo,
        roomType: parsed.data.roomType,
        waterSource: parsed.data.waterSource,
        meterType: parsed.data.meterType,
        waterNote: parsed.data.waterNote,
        lightNote: parsed.data.lightNote,
        distanceToMainGateMeters: parsed.data.distanceToMainGateMeters,
        distanceToFacultyMeters: parsed.data.distanceToFacultyMeters,
        distanceToMarketMeters: parsed.data.distanceToMarketMeters,
        amenities: parsed.data.amenities,
        availableRooms: parsed.data.availableRooms,
        maxOccupancy: parsed.data.maxOccupancy,
        caretakerName: parsed.data.caretakerName ?? user.fullName,
        caretakerPhone: parsed.data.caretakerPhone ?? user.phone,
        // Listings start verified because the landlord account is verified.
        isVerified: true,
        status: "ACTIVE",
        // The first photo becomes the cover image.
        images: {
          create: [
            { url: firstImage, isCover: true, sortOrder: 0 },
            ...restImages.map((url, index) => ({ url, isCover: false, sortOrder: index + 1 })),
          ],
        },
      },
    });

    return json({ id: lodge.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
