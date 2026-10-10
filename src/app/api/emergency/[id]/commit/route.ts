/**
 * src/app/api/emergency/[id]/commit/route.ts
 * WHAT: The "I want to help" commitment gate - reveals the recipient's
 *       verified identity and bank details, and starts the 2-hour timer.
 * WHY : This is the only place private data changes hands, so it demands an
 *       explicit, logged acceptance. Reading someone's bank details without
 *       intending to send is the exact behaviour the 7-day pause deters.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, goodwillCommitSchema } from "@/lib/validators";
import { commitToHelp, revealFor, COMMIT_WINDOW_MINUTES } from "@/lib/goodwill";

type RouteContext = { params: { id: string } };

/**
 * POST /api/emergency/:id/commit
 * Body: { accept: true } - the commitment notice has been read and accepted.
 * Returns the revealed details and the moment the timer expires.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only students can help on the support board.", 403);
    // A helper must be verified too - anonymity is not a shield for a
    // third party fishing for account numbers.
    if (!user.isVerified) return fail("Verify your student ID before helping on the board.", 403);

    const body = await readJson(request);
    const parsed = safeParse(goodwillCommitSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const { help, reveal } = await commitToHelp(user.id, context.params.id);

    return json({
      helpId: help.id,
      requestId: help.requestId,
      status: help.status,
      expiresAt: help.expiresAt,
      windowMinutes: COMMIT_WINDOW_MINUTES,
      reveal,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/emergency/:id/commit
 * WHAT: Re-reads the revealed details for a helper who already committed.
 * WHY : A page refresh must not lose the account number mid-transfer, and it
 *       must not re-open the door to someone who never committed. Re-reading
 *       never restarts the timer - only POST does that.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const reveal = await revealFor(user.id, context.params.id);
    return json({ reveal });
  } catch (error) {
    return handleError(error);
  }
}
