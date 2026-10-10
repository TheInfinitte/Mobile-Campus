/**
 * src/app/api/community/route.ts
 * WHAT: The moderated community (gist) board for one campus. Real identities by
 *       default; optional anonymous mode shows a generated alias.
 * WHY : Social trust needs real names, but sensitive topics need anonymity.
 *       Both live on one board with a per-post toggle.
 *
 * ANONYMITY CONTRACT:
 *   - The authorId is ALWAYS stored (moderation + safety) but is NEVER sent to
 *     clients for anonymous posts - not even "is it me?". The author still sees
 *     their own post (we include isMine computed server-side) without exposing
 *     the id anywhere else.
 *   - Anonymity exists ONLY here. Housing, marketplace and gigs always show the
 *     real account, because money changes hands there.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, communityPostSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";
import { rateLimit } from "@/lib/rate-limit";

/**
 * makeAlias
 * WHAT: A display name for anonymous posts, e.g. "Anonymous Student #4821".
 * WHY : A stable-looking random number per post keeps confessions untraceable
 *       to a person while still feeling like a community member.
 */
function makeAlias(): string {
  return `Anonymous Student #${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * GET /api/community?topic=Confessions
 * Returns the viewer's campus board, newest first. Public read for students;
 * landlords are excluded from the board entirely (their app is property-only).
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const topic = url.searchParams.get("topic")?.trim() ?? "";
    const viewer = await getSessionUser();

    // Landlords do not see student social spaces.
    if (viewer?.role === "LANDLORD") {
      return fail("The community board is a student space.", 403);
    }

    const institution = await getViewerInstitution();

    const posts = await prisma.communityPost.findMany({
      where: {
        institutionId: institution.id,
        status: "ACTIVE",
        ...(topic ? { topic: { equals: topic, mode: "insensitive" } } : {}),
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true, level: true, department: true } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return json({
      posts: posts.map((post) => ({
        id: post.id,
        topic: post.topic,
        body: post.body,
        isAnonymous: post.isAnonymous,
        replyCount: post._count.replies,
        createdAt: post.createdAt,
        // Anonymity rule: anonymous posts expose neither the author object nor
        // the authorId. The alias is the only identity shown.
        alias: post.isAnonymous ? post.alias : null,
        author: post.isAnonymous
          ? null
          : {
              id: post.author.id,
              fullName: post.author.fullName,
              avatarUrl: post.author.avatarUrl,
              level: post.author.level,
              department: post.author.department,
            },
        isMine: viewer ? post.authorId === viewer.id : false,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/community
 * Body: { body, topic?, isAnonymous? }
 * Students only. Rate limited to 10 posts a day to slow down spam.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") {
      return fail("Only student accounts can post on the community board.", 403);
    }

    const body = await readJson(request);
    const parsed = safeParse(communityPostSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const limit = rateLimit(`community-post:${user.id}`, 10, 24 * 60 * 60 * 1000);
    if (!limit.allowed) return fail("You have posted a lot today. Take a breather and try again tomorrow.", 429);

    const post = await prisma.communityPost.create({
      data: {
        authorId: user.id,
        institutionId: user.institutionId,
        topic: parsed.data.topic ?? null,
        body: parsed.data.body,
        isAnonymous: parsed.data.isAnonymous,
        // Generated once and stored, so the alias never changes later.
        alias: parsed.data.isAnonymous ? makeAlias() : null,
      },
    });

    return json({ id: post.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
