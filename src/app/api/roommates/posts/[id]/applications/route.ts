/**
 * src/app/api/roommates/posts/[id]/applications/route.ts
 * WHAT: Apply to join a roommate post, and list the applications on a post.
 * WHY : A group needs a structured way to say "I want in" and for the poster to
 *       compare applicants by compatibility before choosing.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { compatibility, type ProfileWithUser } from "@/lib/compatibility";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, roommateApplicationSchema } from "@/lib/validators";

type RouteContext = { params: { id: string } };

/**
 * GET /api/roommates/posts/:id/applications
 * Returns the applications on a post. Only the post author may see them.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const post = await prisma.roommatePost.findUnique({ where: { id: context.params.id } });
    if (!post) return fail("That post was not found.", 404);
    if (post.authorId !== user.id) return fail("Only the person who posted this can see applications.", 403);

    const applications = await prisma.roommateApplication.findMany({
      where: { postId: post.id },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, level: true, department: true, isVerified: true } },
      },
      orderBy: [{ compatibilityScore: "desc" }, { createdAt: "desc" }],
    });

    return json({ applications });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/roommates/posts/:id/applications
 * Body: { postId, message? }
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(roommateApplicationSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const post = await prisma.roommatePost.findUnique({
      where: { id: context.params.id },
      include: { author: { select: { id: true, fullName: true, gender: true, institutionId: true } } },
    });
    if (!post) return fail("That post was not found.", 404);

    // MULTI-CAMPUS SILO: students apply within their own school only.
    if (post.institutionId !== user.institutionId) {
      return fail("This post is from a different institution.", 403);
    }
    // SAME-GENDER RULE: pairing is strictly same-gender for safety.
    if (!user.gender || user.gender.toLowerCase() !== (post.author.gender ?? "").toLowerCase()) {
      return fail("For safety and privacy, roommate pairing is same-gender only.", 409);
    }

    if (post.status !== "OPEN") return fail("This post is no longer accepting applications.", 409);
    if (post.slotsLeft <= 0) return fail("All the spots on this post have been filled.", 409);
    if (post.authorId === user.id) return fail("You cannot apply to your own post.", 400);
    if (!user.isVerified) return fail("Verify your student status before applying.", 403);

    // Only one application per person per post (also a unique index).
    const existing = await prisma.roommateApplication.findUnique({
      where: { postId_userId: { postId: post.id, userId: user.id } },
    });
    if (existing) return fail("You have already applied to this post.", 409);

    // Calculate compatibility now, so the poster sees a score immediately.
    let score: number | null = null;
    const [myProfile, authorProfile] = await Promise.all([
      prisma.roommateProfile.findUnique({
        where: { userId: user.id },
        include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
      }),
      prisma.roommateProfile.findUnique({
        where: { userId: post.authorId },
        include: { user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } } },
      }),
    ]);

    if (myProfile && authorProfile) {
      score = compatibility(myProfile as ProfileWithUser, authorProfile as ProfileWithUser).score;
    }

    const application = await prisma.roommateApplication.create({
      data: {
        postId: post.id,
        userId: user.id,
        message: parsed.data.message,
        compatibilityScore: score,
        status: "PENDING",
      },
    });

    await notify({
      userId: post.authorId,
      title: "New roommate application",
      body: `${user.fullName} wants to join "${post.title}"${score ? ` (${score}% compatible)` : ""}.`,
      link: `/roommates/${post.id}`,
      sms: true,
      smsBody: `${user.fullName} applied to your roommate post "${post.title}" on Mobile Campus.`,
    });

    return json({ id: application.id, compatibilityScore: score }, 201);
  } catch (error) {
    return handleError(error);
  }
}
