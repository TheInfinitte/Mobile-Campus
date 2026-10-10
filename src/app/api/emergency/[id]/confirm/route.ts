/**
 * src/app/api/emergency/[id]/confirm/route.ts
 * WHAT: The recipient confirms the support landed in their own bank account.
 * WHY : The other half of the two-way loop, and the only action that credits
 *       a helper's goodwill badge. It also ends the request: after this the
 *       recipient's bank details are no longer reachable by anyone.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { confirmReceived } from "@/lib/goodwill";

type RouteContext = { params: { id: string } };

/**
 * POST /api/emergency/:helpId/confirm
 * No body. Only the recipient, only while a helper has marked funds sent.
 */
export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const help = await confirmReceived(user.id, context.params.id);
    return json({ helpId: help.id, status: help.status, confirmedAt: help.confirmedAt });
  } catch (error) {
    return handleError(error);
  }
}
