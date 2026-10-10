/**
 * src/app/api/admin/listings/route.ts
 * WHAT: An admin's view of every lodge, with the power to hide, restore or remove
 *       a listing.
 * WHY : When a scam report comes in, an admin must be able to take a listing down
 *       in seconds, from a phone, without touching the database.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";

/** The only statuses an admin may set. */
const ALLOWED = ["ACTIVE", "INACTIVE", "UNDER_REVIEW", "REMOVED"] as const;

/**
 * GET /api/admin/listings?status=UNDER_REVIEW
 * Admin only.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();

    const status = new URL(request.url).searchParams.get("status");

    const lodges = await prisma.lodge.findMany({
      where: status ? { status: status as "ACTIVE" } : {},
      include: {
        landlord: { select: { id: true, fullName: true, phone: true, isVerified: true } },
        images: { where: { isCover: true }, take: 1 },
        _count: { select: { reviews: true, viewingRequests: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return json({
      lodges: lodges.map((lodge) => ({
        id: lodge.id,
        title: lodge.title,
        area: lodge.area,
        monthlyRentKobo: lodge.monthlyRentKobo,
        isVerified: lodge.isVerified,
        status: lodge.status,
        availableRooms: lodge.availableRooms,
        ratingAverage: lodge.ratingAverage,
        reviewCount: lodge._count.reviews,
        viewingCount: lodge._count.viewingRequests,
        coverImage: lodge.images[0]?.url ?? null,
        createdAt: lodge.createdAt,
        landlord: lodge.landlord,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/admin/listings
 * Body: { id, status }
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();

    const body = (await readJson(request)) as { id?: string; status?: string };
    if (!body.id || !body.status || !ALLOWED.includes(body.status as (typeof ALLOWED)[number])) {
      return fail("Provide a listing id and a valid status.", 400);
    }

    const lodge = await prisma.lodge.findUnique({ where: { id: body.id } });
    if (!lodge) return fail("That listing was not found.", 404);

    const updated = await prisma.lodge.update({
      where: { id: lodge.id },
      data: { status: body.status as "ACTIVE" },
    });

    return json({ id: updated.id, status: updated.status });
  } catch (error) {
    return handleError(error);
  }
}
