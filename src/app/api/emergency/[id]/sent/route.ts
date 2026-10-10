/**
 * src/app/api/emergency/[id]/sent/route.ts
 * WHAT: The helper marks "I have sent the funds" from their own bank app.
 * WHY : Half of the two-way confirmation loop. It stops the snooper timer,
 *       but it does not close anything - only the recipient can do that, so
 *       a helper can never self-certify their own kindness.
 *
 * The platform never touches the money: this route records a statement the
 * helper made about a transfer they did in their own bank app.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJson, json, handleError } from "@/lib/api";
import { safeParse, goodwillSentSchema } from "@/lib/validators";
import { markSent } from "@/lib/goodwill";

type RouteContext = { params: { id: string } };

/**
 * POST /api/emergency/:helpId/sent
 * Body: { note? } - an optional line like "Sent from my GTB account".
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(goodwillSentSchema, body);

    const help = await markSent(user.id, context.params.id, parsed.ok ? parsed.data.note : undefined);
    return json({ helpId: help.id, status: help.status, sentAt: help.sentAt });
  } catch (error) {
    return handleError(error);
  }
}
