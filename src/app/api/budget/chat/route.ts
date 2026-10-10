/**
 * src/app/api/budget/chat/route.ts
 * WHAT: The AI Budget Assistant endpoint. It parses the student's sentence with
 *       Claude (server-side only), then queries the REAL database and returns
 *       matched lodges, items and gigs.
 * WHY : This route is the whole feature. It has to be secure, honest and fast:
 *
 *   SECURITY
 *   - The Anthropic key is only ever read here, on the server.
 *   - We send ONLY the budget sentence to Claude. No name, phone, matric number,
 *     location or any other personal data leaves our server.
 *   - Rate limited: 12 requests per 10 minutes per user (or per IP when signed
 *     out) because each call costs money.
 *
 *   HONESTY
 *   - Every result comes from a Prisma query. The AI never invents a listing.
 *   - If Claude is down we fall back to our own parser and label the answer
 *     "Smart filters" so the user is never misled.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { parseBudgetIntent } from "@/lib/budget-ai";
import { buildPlan } from "@/lib/budget-match";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, budgetPromptSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";

/**
 * POST /api/budget/chat
 * Body: { prompt, area? }
 * Returns: { data: BudgetPlan }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readJson(request);
    const parsed = safeParse(budgetPromptSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // ---------------------------------------------------------------
    // RATE LIMIT - keyed by user when signed in, otherwise by IP address.
    // ---------------------------------------------------------------
    const viewer = await getSessionUser();
    const key = viewer ? `budget:${viewer.id}` : `budget:ip:${request.headers.get("x-forwarded-for") ?? "unknown"}`;
    const limit = rateLimit(key, 12, 10 * 60 * 1000);
    if (!limit.allowed) {
      return fail(
        `You have asked a lot of questions. Please try again in ${Math.ceil(limit.retryAfterMs / 60000)} minute(s).`,
        429
      );
    }

    // ---------------------------------------------------------------
    // 1. PARSE THE INTENT (Claude, with a local fallback).
    //    Only the sentence is sent - nothing about who the user is.
    // ---------------------------------------------------------------
    const promptWithArea = parsed.data.area
      ? `${parsed.data.prompt} (in ${parsed.data.area})`
      : parsed.data.prompt;

    // MULTI-CAMPUS: the parser only recognises the viewer's own communities,
    // and every database query below stays inside their institution.
    const institution = await getViewerInstitution();
    const { intent, source, latencyMs } = await parseBudgetIntent(promptWithArea, {
      institutionName: institution.name,
      areas: institution.areas,
    });

    // ---------------------------------------------------------------
    // 2. QUERY THE REAL DATABASE with the parsed filters.
    // ---------------------------------------------------------------
    const plan = await buildPlan(intent, source, institution.id);

    // ---------------------------------------------------------------
    // 3. Remember the session so the student can come back to it and so we
    //    can see how often the AI fallback is used.
    // ---------------------------------------------------------------
    await prisma.budgetSession
      .create({
        data: {
          userId: viewer?.id ?? null,
          prompt: parsed.data.prompt,
          parsedJson: JSON.stringify(intent),
          resultsJson: JSON.stringify({
            lodges: plan.lodges.map((lodge) => lodge.id),
            items: plan.items.map((item) => item.id),
            gigs: plan.gigs.map((gig) => gig.id),
          }),
          source,
          latencyMs,
        },
      })
      // Saving the session must never break the answer.
      .catch(() => null);

    return json(plan);
  } catch (error) {
    return handleError(error);
  }
}
