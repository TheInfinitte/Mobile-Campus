/**
 * src/app/api/errands/route.ts
 * WHAT: Lists open campus errands and lets a student post one.
 * WHY : Errands are strictly NON-FOOD peer-to-peer logistics - document drops,
 *       marketplace handovers, hostel key runs. Food belongs in the Food
 *       Directory, so the category list here never mentions it.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { errandWhere, errandOrderBy, paginate, PAGE_SIZE } from "@/lib/search";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, errandFilterSchema, createErrandSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/errands?category=Document%20Drop&q=library
 * Public list of open, unclaimed tasks at the viewer's campus.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = safeParse(errandFilterSchema, params);
    if (!parsed.ok) return fail(parsed.error, 400);

    const filter = parsed.data;
    const { skip, take } = paginate(filter.page, PAGE_SIZE);
    // MULTI-CAMPUS SILO: only errands from the viewer's own school.
    const institution = await getViewerInstitution();

    const [total, errands] = await Promise.all([
      prisma.errand.count({ where: errandWhere(filter, institution.id) }),
      prisma.errand.findMany({
        where: errandWhere(filter, institution.id),
        orderBy: errandOrderBy(filter.sort),
        skip,
        take,
        include: { poster: { select: { id: true, fullName: true, isVerified: true, avatarUrl: true } } },
      }),
    ]);

    return json({
      errands: errands.map((errand) => ({
        id: errand.id,
        title: errand.title,
        description: errand.description,
        category: errand.category,
        pickupPoint: errand.pickupPoint,
        dropOffPoint: errand.dropOffPoint,
        feeKobo: errand.feeKobo,
        isNegotiable: errand.isNegotiable,
        dueAt: errand.dueAt,
        status: errand.status,
        isSponsored: errand.isSponsored,
        createdAt: errand.createdAt,
        poster: errand.poster,
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
 * POST /api/errands
 * Body: { title, description, category, pickupPoint, dropOffPoint, feeKobo,
 *         isNegotiable, dueAt? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only students can post errands.", 403);

    const body = await readJson(request);
    const parsed = safeParse(createErrandSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // A due time in the past makes no sense for a task nobody has claimed.
    if (parsed.data.dueAt && parsed.data.dueAt.getTime() < Date.now()) {
      return fail("The deadline must be in the future.", 400);
    }
    // Pickup and drop-off in the exact same spot is not a delivery.
    if (parsed.data.pickupPoint.trim().toLowerCase() === parsed.data.dropOffPoint.trim().toLowerCase()) {
      return fail("The pickup point and drop-off point must be different places.", 400);
    }

    const errand = await prisma.errand.create({
      data: {
        posterId: user.id,
        institutionId: user.institutionId,
        title: parsed.data.title,
        description: parsed.data.description,
        // The validator enum guarantees this is a NON-FOOD category.
        category: parsed.data.category,
        pickupPoint: parsed.data.pickupPoint.trim(),
        dropOffPoint: parsed.data.dropOffPoint.trim(),
        feeKobo: parsed.data.feeKobo,
        isNegotiable: parsed.data.isNegotiable,
        dueAt: parsed.data.dueAt ?? null,
        status: "OPEN",
      },
    });

    return json({ id: errand.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
