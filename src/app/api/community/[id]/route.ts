/**
 * src/app/api/community/[id]/route.ts
 * WHAT: One community post with its replies, plus replying and author deletion.
 * WHY : Threads live under the post; replies follow the same anonymity rules.
 *
 * ANONYMITY CONTRACT (same as the list route): anonymous authors are shown as
 * their alias only; the stored authorId is used server-side for "isMine" and
 * for moderation, never sent to clients.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, communityReplySchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

type RouteContext = { params: { id: string } };

/**
 * makeAlias
 * WHAT: Display name for anonymous replies.
 * WHY : Same rule as posts; a different number per reply keeps them unlinkable.
 */
function makeAlias(): string {
  return `Anonymous Student #${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * personFor
 * WHAT: Shapes one author (or alias) for the public response.
 * WHY : Centralises the anonymity rule so it cannot drift between post/reply.
 */
function personFor(
  isAnonymous: boolean,
  alias: string | null,
  author: { id: string; fullName: string; avatarUrl: string | null; level: string | null; department: string | null },
  viewerId: string | null
) {
  return {
    isAnonymous,
    alias: isAnonymous ? alias : null,
    isMine: viewerId ? author.id === viewerId : false,
    author: isAnonymous
      ? null
      : { id: author.id, fullName: author.fullName, avatarUrl: author.avatarUrl, level: author.level, department: author.department },
  };
}

/**
 * GET /api/community/:id
 * Returns the post plus its ACTIVE replies, oldest first.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const viewer = await getSessionUser();
    if (viewer?.role === "LANDLORD") return fail("The community board is a student space.", 403);

    const post = await prisma.communityPost.findUnique({
      where: { id: context.params.id },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true, level: true, department: true } },
        replies: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          take: 200,
          include: { author: { select: { id: true, fullName: true, avatarUrl: true, level: true, department: true } } },
        },
      },
    });
    if (!post || post.status !== "ACTIVE") return fail("That post is no longer available.", 404);

    const viewerId = viewer?.id ?? null;

    return json({
      post: {
        id: post.id,
        topic: post.topic,
        body: post.body,
        createdAt: post.createdAt,
        ...personFor(post.isAnonymous, post.alias, post.author, viewerId),
      },
      replies: post.replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        createdAt: reply.createdAt,
        ...personFor(reply.isAnonymous, reply.alias, reply.author, viewerId),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/community/:id  (add a reply)
 * Body: { body, isAnonymous? }
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only student accounts can reply on the community board.", 403);

    const post = await prisma.communityPost.findUnique({ where: { id: context.params.id } });
    if (!post || post.status !== "ACTIVE") return fail("That post is no longer available.", 404);
    if (post.institutionId !== user.institutionId) return fail("This board belongs to another institution.", 403);

    const body = await readJson(request);
    const parsed = safeParse(communityReplySchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const limit = rateLimit(`community-reply:${user.id}`, 30, 24 * 60 * 60 * 1000);
    if (!limit.allowed) return fail("Too many replies today. Try again tomorrow.", 429);

    const reply = await prisma.communityReply.create({
      data: {
        postId: post.id,
        authorId: user.id,
        body: parsed.data.body,
        isAnonymous: parsed.data.isAnonymous,
        alias: parsed.data.isAnonymous ? makeAlias() : null,
      },
    });

    return json({ id: reply.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/community/:id
 * The author removes their own post (soft delete -> REMOVED).
 * Admin takedowns live in /api/admin/community instead.
 */
export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const post = await prisma.communityPost.findUnique({ where: { id: context.params.id } });
    if (!post) return fail("That post was not found.", 404);
    if (post.authorId !== user.id && user.role !== "ADMIN") {
      return fail("Only the author can delete this post.", 403);
    }

    await prisma.communityPost.update({ where: { id: post.id }, data: { status: "REMOVED" } });
    return json({ id: post.id, status: "REMOVED" });
  } catch (error) {
    return handleError(error);
  }
}
