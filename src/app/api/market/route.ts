/**
 * src/app/api/market/route.ts
 * WHAT: Lists marketplace items (with the Graduating Student Drop filter) and
 *       lets a student list something for sale.
 * WHY : The P2P market is how students buy a fan for ₦14,000 instead of ₦45,000,
 *       and how final-year students clear out before they leave.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { marketWhere, marketOrderBy, paginate, PAGE_SIZE } from "@/lib/search";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, marketFilterSchema, createMarketItemSchema } from "@/lib/validators";
import { isAllowedImage } from "@/lib/cloudinary";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/market?category=Fan&maxKobo=2000000&graduatingOnly=true
 * Public: browsing is free for everyone.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = safeParse(marketFilterSchema, params);
    if (!parsed.ok) return fail(parsed.error, 400);

    const filter = parsed.data;
    const { skip, take } = paginate(filter.page, PAGE_SIZE);

    // MULTI-CAMPUS SILO: only items from the viewer's own school.
    const institution = await getViewerInstitution();

    const [total, items] = await Promise.all([
      prisma.marketItem.count({ where: marketWhere(filter, institution.id) }),
      prisma.marketItem.findMany({
        where: marketWhere(filter, institution.id),
        orderBy: marketOrderBy(filter.sort),
        skip,
        take,
        include: { seller: { select: { id: true, fullName: true, isVerified: true, avatarUrl: true } } },
      }),
    ]);

    return json({
      items: items.map((item) => ({
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
      })),
      total,
      page: filter.page,
      pageSize: take,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/market
 * Body: a full item object (see createMarketItemSchema).
 * Any signed-in student can sell. Landlords cannot (they have the housing section).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(createMarketItemSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    if (user.role !== "STUDENT") return fail("Only students can list items on the marketplace.", 403);

    if (!parsed.data.images.every(isAllowedImage)) {
      return fail("Please upload the photos again - one of the image links is not valid.", 400);
    }

    // The "negotiable minimum" must be lower than the asking price, or it is
    // meaningless.
    if (parsed.data.negotiableMinKobo && parsed.data.negotiableMinKobo > parsed.data.priceKobo) {
      return fail("Your lowest acceptable price cannot be higher than your asking price.", 400);
    }

    // A graduating drop must come from someone who says they are a final-year
    // student. We use the level on their profile as the check.
    const isFinalYear = (user.level ?? "").toLowerCase().includes("400") || (user.level ?? "").toLowerCase().includes("final");
    const graduatingDrop = parsed.data.isGraduatingDrop && isFinalYear;

    const item = await prisma.marketItem.create({
      data: {
        sellerId: user.id,
        institutionId: user.institutionId,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        priceKobo: parsed.data.priceKobo,
        negotiableMinKobo: parsed.data.negotiableMinKobo ?? null,
        condition: parsed.data.condition,
        area: parsed.data.area,
        pickupNote: parsed.data.pickupNote,
        images: parsed.data.images,
        // Only honour the flag if they really are a final-year student.
        isGraduatingDrop: graduatingDrop,
        status: "AVAILABLE",
      },
    });

    return json({ id: item.id, isGraduatingDrop: graduatingDrop }, 201);
  } catch (error) {
    return handleError(error);
  }
}
