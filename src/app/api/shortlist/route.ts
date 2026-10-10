/**
 * src/app/api/shortlist/route.ts
 * WHAT: Adds and removes shortlisted lodges, items and gigs, and lists them.
 * WHY : Shortlisting is the ONE action a provisional (fresher) account is allowed
 *       to take. It lets a fresher prepare everything before their verification
 *       is approved.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";

/**
 * GET /api/shortlist
 * Returns everything the user has shortlisted.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const items = await prisma.shortlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        lodge: {
          select: {
            id: true,
            title: true,
            area: true,
            monthlyRentKobo: true,
            annualRentKobo: true,
            isVerified: true,
            images: { where: { isCover: true }, take: 1 },
          },
        },
        marketItem: { select: { id: true, title: true, priceKobo: true, images: true, status: true } },
        gig: { select: { id: true, title: true, budgetKobo: true, category: true, status: true } },
      },
    });

    return json({
      shortlist: items.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        lodge: entry.lodge ? { ...entry.lodge, coverImage: entry.lodge.images[0]?.url ?? null, images: undefined } : null,
        marketItem: entry.marketItem,
        gig: entry.gig,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/shortlist
 * Body: { lodgeId? | marketItemId? | gigId? }
 * Toggles the entry: if it exists it is removed, otherwise it is added.
 * That makes the heart button a single tap in both directions.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = (await readJson(request)) as { lodgeId?: string; marketItemId?: string; gigId?: string };

    const { lodgeId, marketItemId, gigId } = body;
    if (!lodgeId && !marketItemId && !gigId) {
      return fail("Provide a lodge, item or gig to shortlist.", 400);
    }

    // Find an existing entry (the unique indexes make this a single lookup).
    const existing = await prisma.shortlist.findFirst({
      where: { userId: user.id, ...(lodgeId ? { lodgeId } : marketItemId ? { marketItemId } : { gigId }) },
    });

    if (existing) {
      await prisma.shortlist.delete({ where: { id: existing.id } });
      return json({ shortlisted: false });
    }

    await prisma.shortlist.create({
      data: {
        userId: user.id,
        lodgeId: lodgeId ?? null,
        marketItemId: marketItemId ?? null,
        gigId: gigId ?? null,
      },
    });

    return json({ shortlisted: true }, 201);
  } catch (error) {
    return handleError(error);
  }
}
