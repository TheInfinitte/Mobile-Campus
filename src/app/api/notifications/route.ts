/**
 * src/app/api/notifications/route.ts
 * WHAT: Lists the user's notifications and marks them as read.
 * WHY : In-app notifications are free, so we always write one - even when an SMS
 *       was also sent. This endpoint powers the bell screen.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { markAllRead } from "@/lib/notifications";
import { fail, json, handleError } from "@/lib/api";

/**
 * GET /api/notifications?unreadOnly=true
 * Returns the 50 most recent notifications.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const unreadOnly = new URL(request.url).searchParams.get("unreadOnly") === "true";

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    return json({ notifications, unread });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/notifications
 * Body: { id?, all? } - mark one notification read, or all of them.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean };

    if (body.all) {
      await markAllRead(user.id);
      return json({ updated: "all" });
    }

    if (!body.id) return fail("Provide a notification id, or set all to true.", 400);

    // Only update notifications that belong to this user.
    const updated = await prisma.notification.updateMany({
      where: { id: body.id, userId: user.id },
      data: { isRead: true, readAt: new Date() },
    });

    return json({ updated: updated.count });
  } catch (error) {
    return handleError(error);
  }
}
