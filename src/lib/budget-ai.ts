/**
 * src/lib/budget-ai.ts
 * WHAT: Sends a student's plain-English budget message to the Anthropic Claude
 *       API and gets back strict JSON we can safely query the database with.
 * WHY : This is the "AI" in the AI Budget Assistant. The model's ONLY job is
 *       parsing language into numbers and filters. It never invents listings -
 *       every result shown comes from a real database query.
 *
 * SECURITY RULES FOLLOWED HERE:
 *   - The API key is used server-side only. It is never imported by a client
 *     component and never appears in NEXT_PUBLIC_*.
 *   - We send ONLY the budget sentence. No name, phone, matric number, address
 *     or any other personal data leaves our server.
 *   - The response is re-validated with our own parser before use, so a bad or
 *     hallucinated model output cannot break the app.
 *   - If Claude is down, slow or unconfigured we fall back to the local regex
 *     parser in fallback-parse.ts. The feature never dies.
 */
import { env } from "./env";
import { parseNairaInput } from "./money";
import { parseIntentLocally } from "./fallback-parse";
import type { BudgetCategory, ParsedIntent } from "@/types/budget";

/**
 * buildSystemPrompt
 * WHAT: The JSON contract we demand from the model, with the viewer's own
 *       institution and community names baked in.
 * WHY : Multi-campus: the model must only recognise areas that exist at the
 *       student's school, otherwise it would "understand" a DELSU area for a
 *       UNIBEN student and return empty results.
 */
function buildSystemPrompt(institutionName: string, areas: string[]): string {
  return `You are the parsing engine for "Mobile Campus", a student housing and marketplace app at ${institutionName}, Nigeria.

Your ONLY job is to turn a student's message into strict JSON. You must NOT invent prices, listings, lodges or items. You only extract what the student said.

Return JSON with EXACTLY this shape and no other text:
{
  "totalBudgetKobo": number,        // total money they have, in KOBO (1 naira = 100 kobo). 0 if not stated.
  "needs": [
    {
      "category": "housing" | "market" | "gig" | "general",
      "description": string,        // short phrase, e.g. "single self contain" or "standing fan"
      "maxKobo": number,            // their stated maximum for this need, in KOBO. 0 if no limit given.
      "area": string,               // Community if mentioned (valid names: ${areas.join(", ") || "any community the student names"}). Empty string otherwise.
      "months": number              // housing only: number of months of rent they mean. 12 if they said "a year"/"per year", 0 if unclear.
    }
  ],
  "preferences": string[],          // hard requirements e.g. ["borehole","prepaid meter","close to gate"]
  "wantsRoommate": boolean,         // true if they mentioned sharing or a roommate
  "summary": string                 // one friendly sentence confirming what you understood
}

Rules:
- Money written as "150k", "150,000", "₦150000" or "one hundred and fifty thousand" all mean 150000 naira = 15000000 kobo.
- "1.5m" or "1.5 million" = 1500000 naira.
- If a category is not clearly housing, market or gig, use "general".
- Never add needs the student did not mention. An empty "needs" array is correct when they only said an amount.
- Output raw JSON only. No markdown, no backticks, no commentary.`;
}

/**
 * isBudgetAiEnabled
 * WHAT: True when an Anthropic API key is present.
 * WHY : Lets the UI show "AI is offline, using smart filters" honestly instead
 *       of pretending.
 */
export function isBudgetAiEnabled(): boolean {
  return Boolean(env.anthropic.apiKey) && !env.anthropic.apiKey.includes("your-");
}

/**
 * extractJson
 * WHAT: Pulls the first JSON object out of a model's reply.
 * WHY : Models sometimes wrap JSON in prose or backticks even when told not to.
 *       We slice from the first "{" to the last "}" to be tolerant.
 */
function extractJson(text: string): string {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return "";
  return cleaned.slice(start, end + 1);
}

/**
 * coerceIntent
 * WHAT: Validates and cleans the JSON from the model into our ParsedIntent type.
 * WHY : The model can return a string where we need a number, or a made-up
 *       category. Anything unusable is dropped rather than trusted.
 */
function coerceIntent(raw: unknown, originalPrompt: string): ParsedIntent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const allowedCategories: BudgetCategory[] = ["housing", "market", "gig", "general"];

  // Budget: accept a number or a text amount like "150k".
  let totalBudgetKobo = 0;
  if (typeof obj.totalBudgetKobo === "number" && Number.isFinite(obj.totalBudgetKobo)) {
    totalBudgetKobo = Math.max(0, Math.round(obj.totalBudgetKobo));
  } else if (typeof obj.totalBudgetKobo === "string") {
    totalBudgetKobo = parseNairaInput(obj.totalBudgetKobo);
  }

  // Needs: keep only well-formed entries.
  const needs = Array.isArray(obj.needs)
    ? (obj.needs as Record<string, unknown>[])
        .map((need) => {
          const category = String(need?.category ?? "").toLowerCase() as BudgetCategory;
          const description = String(need?.description ?? "").trim().slice(0, 80);
          const maxKobo =
            typeof need?.maxKobo === "number"
              ? Math.max(0, Math.round(need.maxKobo))
              : typeof need?.maxKobo === "string"
                ? parseNairaInput(need.maxKobo)
                : 0;
          const months = typeof need?.months === "number" && need.months > 0 ? Math.min(24, Math.round(need.months)) : 0;
          return {
            category: allowedCategories.includes(category) ? category : ("general" as BudgetCategory),
            description,
            maxKobo,
            area: String(need?.area ?? "").trim().slice(0, 40),
            months,
          };
        })
        .filter((need) => need.description.length > 0 || need.maxKobo > 0)
        .slice(0, 6) // A student will never realistically need more than 6 things.
    : [];

  const preferences = Array.isArray(obj.preferences)
    ? (obj.preferences as unknown[]).map((p) => String(p).trim().slice(0, 40)).filter(Boolean).slice(0, 8)
    : [];

  const summary = String(obj.summary ?? "").trim().slice(0, 240);

  // If the model gave us nothing usable, say so.
  if (totalBudgetKobo === 0 && needs.length === 0 && preferences.length === 0) {
    void originalPrompt;
    return null;
  }

  return {
    totalBudgetKobo,
    needs,
    preferences,
    wantsRoommate: Boolean(obj.wantsRoommate),
    summary: summary || "Here is what I understood from your message.",
  };
}

/**
 * parseBudgetIntent
 * WHAT: The main entry point. Tries Claude first, then falls back to our own
 *       local parser if anything goes wrong.
 * WHY : The assistant must work even when the AI provider is down, the key is
 *       missing, or the network is slow on a bad connection.
 *
 * Returns the parsed intent plus which source produced it.
 */
export async function parseBudgetIntent(
  prompt: string,
  options?: { institutionName?: string; areas?: string[] }
): Promise<{ intent: ParsedIntent; source: "AI" | "FALLBACK"; latencyMs: number }> {
  const started = Date.now();
  // The viewer's campus and its communities, for both the AI and the fallback.
  const institutionName = options?.institutionName ?? "Delta State University (DELSU), Abraka";
  const areas = options?.areas ?? [];

  // --- Attempt 1: Claude ---------------------------------------------------
  if (isBudgetAiEnabled()) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.anthropic.apiKey,
          // Anthropic requires this version header.
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.anthropic.model,
          // A small cap keeps cost and latency low for a parsing task.
          max_tokens: 1024,
          temperature: 0, // Deterministic output - we want the same parse every time.
          system: buildSystemPrompt(institutionName, areas),
          messages: [{ role: "user", content: prompt.slice(0, 400) }],
        }),
        cache: "no-store",
        // Abort if the model takes too long; the fallback will handle it.
        signal: AbortSignal.timeout(12000),
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          content?: { type: string; text?: string }[];
        };
        // Claude returns content blocks; we want the first text block.
        const text = payload.content?.find((block) => block.type === "text")?.text ?? "";
        const intent = coerceIntent(JSON.parse(extractJson(text) || "null"), prompt);

        if (intent) {
          return { intent, source: "AI", latencyMs: Date.now() - started };
        }
        console.warn("[budget-ai] Model returned unusable JSON - falling back.");
      } else {
        console.warn(`[budget-ai] Anthropic responded ${response.status} - falling back.`);
      }
    } catch (error) {
      // Network error, timeout or malformed JSON - all handled the same way.
      console.warn("[budget-ai] Falling back to local parser:", error instanceof Error ? error.message : error);
    }
  }

  // --- Attempt 2: our own parser ------------------------------------------
  return {
    intent: parseIntentLocally(prompt, areas),
    source: "FALLBACK",
    latencyMs: Date.now() - started,
  };
}

