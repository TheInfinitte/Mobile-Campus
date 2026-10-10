/**
 * src/app/api/admin/moderation/route.ts
 * WHAT: The admin endpoint behind the content moderation page.
 *       GET    - the moderation queue across market items, gigs and rooms.
 *       PATCH  - apply one action (flag / hide / restore / delete) to one item.
 * WHY : Moderation is a privileged mutation. The route re-checks that the
 *       caller is staff on EVERY request - never trust the page that linked
 *       here, because anyone can send a request to this URL directly.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { json, fail, handleError, readJson } from "@/lib/api";
import { safeParse, moderationSchema } from "@/lib/validators";
import { moderate, moderationQueue } from "@/lib/moderation";

/**
 * GET /api/admin/moderation
 * WHAT: Returns everything waiting for an admin, plus a per-type breakdown so
 *       the UI can show counts without a second request.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();

    const { rows, openReports } = await moderationQueue();

    // Counts per type, so the page can say "3 items, 1 gig, 2 rooms".
    const counts = {
      MARKET_ITEM: rows.filter((r) => r.type === "MARKET_ITEM").length,
      GIG: rows.filter((r) => r.type === "GIG").length,
      LODGE: rows.filter((r) => r.type === "LODGE").length,
    };

    return json({ rows, counts, openReports });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/admin/moderation
 * WHAT: Applies a moderation action.
 * Body: { type, id, action, note? }
 * WHY : PATCH (not DELETE) because most actions change a row rather than
 *       removing it; DELETE is one action value among four, and the route
 *       still returns 200 so the UI can update the row in place.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    // The admin's own id is recorded on the row as an audit trail.
    const admin = await requireAdmin();

    const body = await readJson(request);
    const parsed = safeParse(moderationSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const { type, id, action, note } = parsed.data;

    const result = await moderate({
      type,
      id,
      action,
      note,
      adminId: admin.id,
    });

    return json(result);
  } catch (error) {
    return handleError(error);
  }
}
