/**
 * src/app/api/admin/community/route.ts
 * WHAT: Moderation queue for the community board. Unlike the public board,
 *       admins ALWAYS see the true author - anonymous or not.
 * WHY : Secure anonymity means hiding identity from the public, never from
 *       moderation. This is how harmful posts get traced and removed.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { notify } from "@/lib/notifications";

/**
 * GET /api/admin/community?status=ACTIVE|REOVED|ALL
 * Returns posts newest-first with the REAL author on every row.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "ALL";

    const posts = await prisma.communityPost.findMany({
      where: { ...(status !== "ALL" ? { status: status as "ACTIVE" } : {}) },
      include: {
        author: { select: { id: true, fullName: true, phone: true, role: true } },
        institution: { select: { shortName: true } },
        _count: { select: { replies: true, reports: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return json({
      posts: posts.map((post) => ({
        id: post.id,
        body: post.body,
        topic: post.topic,
        isAnonymous: post.isAnonymous,
        alias: post.alias,
        status: post.status,
        createdAt: post.createdAt,
        institution: post.institution.shortName,
        replyCount: post._count.replies,
        reportCount: post._count.reports,
        // Moderation sees the true identity behind every alias.
        author: { id: post.author.id, fullName: post.author.fullName, phone: post.author.phone },
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/admin/community
 * Body: { id, status: "ACTIVE" | "REMOVED" }
 * Restore or take down a post; the author is notified either way.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = (await readJson(request)) as { id?: string; status?: string };
    if (!body.id || (body.status !== "ACTIVE" && body.status !== "REMOVED")) {
      return fail("Provide the post id and a valid status.", 400);
    }

    const post = await prisma.communityPost.findUnique({ where: { id: body.id } });
    if (!post) return fail("That post was not found.", 404);

    await prisma.communityPost.update({ where: { id: post.id }, data: { status: body.status } });

    await notify({
      userId: post.authorId,
      title: body.status === "REMOVED" ? "Your community post was removed" : "Your community post is back",
      body:
        body.status === "REMOVED"
          ? "A moderator removed your post for breaking the community rules."
          : "A moderator restored your post. It is visible on the board again.",
      link: "/community",
    });

    return json({ id: post.id, status: body.status });
  } catch (error) {
    return handleError(error);
  }
}
