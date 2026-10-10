/**
 * src/app/api/food/route.ts
 * WHAT: Lists the approved food spots near the viewer's campus.
 * WHY : The food section is a DIRECTORY, not a shop: no cart, no checkout, no
 *       delivery engine. Students browse cards and order through WhatsApp.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/api";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/food?category=Grills%20%26%20BBQ
 * Returns active (admin-approved) vendors for the viewer's institution only.
 * Sponsored spots come first; within each group the best-rated lead.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const category = new URL(request.url).searchParams.get("category")?.trim() ?? "";
    const institution = await getViewerInstitution();

    const vendors = await prisma.foodVendor.findMany({
      where: {
        // SILO: only spots near the viewer's own campus.
        institutionId: institution.id,
        // Directory shows approved spots only - suggestions stay hidden.
        status: "ACTIVE",
        // Optional category chip filter.
        ...(category ? { categories: { has: category } } : {}),
      },
      orderBy: [
        // MONETISATION HOOK: sponsored slots pin to the top of the directory.
        { isSponsored: "desc" },
        // Best-rated spots next; unrated newcomers fall below.
        { reviews: { _count: "desc" } },
        { createdAt: "desc" },
      ],
      include: {
        reviews: {
          select: { rating: true, comment: true, createdAt: true, user: { select: { fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
          take: 3, // The card shows the three most recent reviews.
        },
        _count: { select: { reviews: true } },
      },
    });

    // True average over ALL reviews of each spot. The card only carries the
    // three newest reviews, so the average must come from its own aggregate.
    const ratingRows = await prisma.foodReview.groupBy({
      by: ["vendorId"],
      _avg: { rating: true },
      _count: { rating: true },
      where: { vendorId: { in: vendors.map((vendor) => vendor.id) } },
    });
    const ratingAverageByVendor: Record<string, number> = {};
    for (const row of ratingRows) {
      if (row._avg.rating !== null && row._count.rating > 0) {
        ratingAverageByVendor[row.vendorId] = Math.round(row._avg.rating * 10) / 10;
      }
    }

    return json({
      vendors: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        description: vendor.description,
        categories: vendor.categories,
        priceMinKobo: vendor.priceMinKobo,
        priceMaxKobo: vendor.priceMaxKobo,
        whatsAppNumber: vendor.whatsAppNumber,
        websiteUrl: vendor.websiteUrl,
        imageUrl: vendor.imageUrl,
        area: vendor.area,
        isSponsored: vendor.isSponsored,
        // Average rating across EVERY review, rounded to one decimal. The
        // `reviews` array is trimmed to three for the card, so averaging it
        // would be wrong - the aggregate below is computed separately.
        ratingAverage: ratingAverageByVendor[vendor.id] ?? null,
        reviewCount: vendor._count.reviews,
        reviews: vendor.reviews,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
