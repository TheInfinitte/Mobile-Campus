/**
 * src/app/api/roommates/posts/route.ts
 * WHAT: The Roommate Board - list open posts, and create a new one.
 * WHY : Sometimes a student already has a room and needs people; sometimes they
 *       want to form a group first and rent together. The board supports both,
 *       for groups of 2, 3, 4 or more.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, roommatePostSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/roommates/posts?area=Ekrejeta
 * Returns open posts, newest first. Public so a fresher can browse.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const area = url.searchParams.get("area")?.trim() ?? "";

    // MULTI-CAMPUS SILO: only posts from the viewer's own school.
    const institution = await getViewerInstitution();

    // SAME-GENDER RULE: a signed-in viewer with a recorded gender only ever
    // sees posts by students of the same gender. Guests see the whole board.
    const viewerForFilter = await getSessionUser();

    const posts = await prisma.roommatePost.findMany({
      where: {
        institutionId: institution.id,
        status: "OPEN",
        ...(area ? { area: { equals: area, mode: "insensitive" } } : {}),
        ...(viewerForFilter?.gender ? { author: { gender: viewerForFilter.gender } } : {}),
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true, level: true, isVerified: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    // If the viewer is signed in, attach their compatibility score to each post
    // so the board can be sorted by "best fit for me".
    const viewer = await getSessionUser();
    let scores = new Map<string, number>();

    if (viewer) {
      const myProfile = await prisma.roommateProfile.findUnique({
        where: { userId: viewer.id },
        include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
      });

      if (myProfile) {
        const authorProfiles = await prisma.roommateProfile.findMany({
          where: { userId: { in: posts.map((post) => post.authorId) } },
          include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
        });

        // Lazy import avoids loading the scorer when nobody is signed in.
        const { compatibility } = await import("@/lib/compatibility");
        for (const authorProfile of authorProfiles) {
          scores.set(
            authorProfile.userId,
            compatibility(myProfile, authorProfile).score
          );
        }
      }
    }

    return json({
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        description: post.description,
        area: post.area,
        groupSize: post.groupSize,
        slotsLeft: post.slotsLeft,
        budgetPerPersonKobo: post.budgetPerPersonKobo,
        moveInDate: post.moveInDate,
        status: post.status,
        createdAt: post.createdAt,
        author: post.author,
        compatibilityScore: scores.get(post.authorId),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/roommates/posts
 * Body: { title, description, area, groupSize, budgetPerPersonKobo, moveInDate?, genderPreference }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(roommatePostSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // Only verified students may post - it keeps the board free of scammers.
    if (user.role !== "STUDENT") return fail("Only students can post on the roommate board.", 403);
    if (!user.isVerified) {
      return fail("Verify your student status before posting on the roommate board.", 403);
    }

    // Maximum 3 open posts per person.
    const limit = rateLimit(`roommate-post:${user.id}`, 3, 24 * 60 * 60 * 1000);
    if (!limit.allowed) return fail("You already have several open posts. Wait for replies first.", 429);

    // SAME-GENDER RULE: we cannot guarantee safe pairing without a recorded
    // gender, so posting requires the questionnaire (which now asks gender).
    if (!user.gender) {
      return fail("Complete the roommate questionnaire first - matching is same-gender only.", 400);
    }

    const profile = await prisma.roommateProfile.findUnique({ where: { userId: user.id } });

    const post = await prisma.roommatePost.create({
      data: {
        authorId: user.id,
        institutionId: user.institutionId,
        profileId: profile?.id ?? null,
        title: parsed.data.title,
        description: parsed.data.description,
        area: parsed.data.area,
        groupSize: parsed.data.groupSize,
        // The author already occupies one slot.
        slotsLeft: parsed.data.groupSize - 1,
        budgetPerPersonKobo: parsed.data.budgetPerPersonKobo,
        moveInDate: parsed.data.moveInDate ?? null,
        // Posts expire after 30 days so the board never shows stale listings.
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return json({ id: post.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
