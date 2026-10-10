/**
 * src/app/api/gigs/route.ts
 * WHAT: Lists open micro-gigs and lets a student post a task.
 * WHY : Micro-gigs (laundry, hair, food runs, tutoring) are how students earn
 *       between semesters. A structured board beats WhatsApp group noise.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { gigWhere, gigOrderBy, paginate, PAGE_SIZE } from "@/lib/search";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, gigFilterSchema, createGigSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/gigs?category=Laundry&area=Ekrejeta
 * Public listing of open tasks.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = safeParse(gigFilterSchema, params);
    if (!parsed.ok) return fail(parsed.error, 400);

    const filter = parsed.data;
    const { skip, take } = paginate(filter.page, PAGE_SIZE);

    // MULTI-CAMPUS SILO: only gigs from the viewer's own school.
    const institution = await getViewerInstitution();

    const [total, gigs] = await Promise.all([
      prisma.gig.count({ where: gigWhere(filter, institution.id) }),
      prisma.gig.findMany({
        where: gigWhere(filter, institution.id),
        orderBy: gigOrderBy(filter.sort),
        skip,
        take,
        include: {
          poster: { select: { id: true, fullName: true, isVerified: true, avatarUrl: true, level: true } },
        },
      }),
    ]);

    return json({
      gigs: gigs.map((gig) => ({
        id: gig.id,
        // Which side of the board this post belongs to.
        gigType: gig.gigType,
        isSponsored: gig.isSponsored,
        title: gig.title,
        description: gig.description,
        category: gig.category,
        area: gig.area,
        budgetKobo: gig.budgetKobo,
        isNegotiable: gig.isNegotiable,
        dueDate: gig.dueDate,
        status: gig.status,
        createdAt: gig.createdAt,
        poster: gig.poster,
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
 * POST /api/gigs
 * Body: { title, description, category, area, budgetKobo, isNegotiable, dueDate? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(createGigSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    if (user.role !== "STUDENT") return fail("Only students can post micro-gigs.", 403);

    // A due date in the past makes no sense.
    if (parsed.data.dueDate && parsed.data.dueDate.getTime() < Date.now()) {
      return fail("The due date must be in the future.", 400);
    }

    const gig = await prisma.gig.create({
      data: {
        posterId: user.id,
        institutionId: user.institutionId,
        // WANTED = hiring help, OFFERED = advertising a personal service.
        gigType: parsed.data.gigType,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        area: parsed.data.area,
        budgetKobo: parsed.data.budgetKobo,
        isNegotiable: parsed.data.isNegotiable,
        dueDate: parsed.data.dueDate ?? null,
        status: "OPEN",
      },
    });

    return json({ id: gig.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
