/**
 * src/app/api/emergency/[id]/release/route.ts
 * WHAT: The recipient lets a committed helper off the hook.
 * WHY : Compassion runs both ways. If help arrived elsewhere, or the student
 *       simply cannot wait, they should never leave a classmate staring at a
 *       2-hour timer - and releasing someone applies no penalty at all.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { releaseHelper } from "@/lib/goodwill";

type RouteContext = { params: { id: string } };

/**
 * POST /api/emergency/:requestId/release
 * No body. Only the person who posted the request.
 */
export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    await releaseHelper(user.id, context.params.id);
    return json({ id: context.params.id, status: "OPEN" });
  } catch (error) {
    return handleError(error);
  }
}
