/**
 * src/lib/fallback-parse.ts
 * WHAT: A plain JavaScript parser that understands Nigerian money phrases and
 *       budget requests, with no AI involved.
 * WHY : Two reasons:
 *       1. If Claude is unavailable the assistant must still work.
 *       2. It gives us a cheap, instant answer for very simple messages like
 *          "150k" - no need to pay for an API call.
 *
 * IT UNDERSTANDS THINGS LIKE:
 *   "I have 150,000"
 *   "I have 150k"
 *   "I need a room under 80k and a fan under 15k"
 *   "room in ekrejeta under 50k, borehole, prepaid"
 */
import { parseNairaInput } from "./money";
import type { BudgetCategory, ParsedIntent } from "@/types/budget";

/** Words that mean the student wants a place to stay. */
const HOUSING_WORDS = ["room", "lodge", "rent", "self contain", "self-contain", "flat", "apartment", "hostel", "accommodation", "house", "single", "chamber"];

/** Words that mean the student wants to buy something. */
const MARKET_WORDS = ["fan", "mattress", "generator", "fridge", "gas", "cylinder", "book", "table", "chair", "wardrobe", "iron", "kettle", "blender", "television", "tv", "mattres", "bed", "cooker", "rice cooker", "extension", "lamp", "solar", "inverter"];

/** Words that mean the student wants to hire a service. */
const GIG_WORDS = ["laundry", "wash", "hair", "braids", "barbing", "food run", "errand", "tutor", "tutoring", "cleaning", "clean", "cook", "photography"];

/**
 * extractMoney
 * WHAT: Finds every money amount in a sentence, with the words around it.
 * WHY : "a room under 80k and a fan under 15k" has two amounts attached to two
 *       different needs. We need to know which is which.
 *
 * Returns each amount in kobo plus the 40 characters that came before it.
 */
function extractMoney(text: string): { kobo: number; context: string }[] {
  const results: { kobo: number; context: string }[] = [];

  // Match numbers with optional commas/decimals and an optional k/m suffix,
  // optionally preceded by ₦ or the word "naira".
  const pattern = /(?:₦|naira\s+)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const rawNumber = match[1].replace(/,/g, "");
    const suffix = (match[2] ?? "").toLowerCase();

    // Rebuild a string parseNairaInput understands.
    const combined = `${rawNumber}${suffix.startsWith("m") ? "m" : suffix.startsWith("k") || suffix.startsWith("thousand") ? "k" : ""}`;
    let kobo = parseNairaInput(combined);

    // "150 thousand" written out long-hand.
    if (suffix === "thousand") kobo = parseNairaInput(`${rawNumber}k`);
    if (suffix === "million") kobo = parseNairaInput(`${rawNumber}m`);

    if (kobo > 0) {
      // Grab the words before this amount so we can work out what it is for.
      const start = Math.max(0, match.index - 45);
      results.push({ kobo, context: text.slice(start, match.index).toLowerCase() });
    }
  }

  return results;
}

/**
 * classify
 * WHAT: Decides which category a phrase belongs to.
 * WHY : "a room under 80k" is housing; "a fan under 15k" is market.
 */
function classify(phrase: string): BudgetCategory {
  const lower = phrase.toLowerCase();
  if (HOUSING_WORDS.some((word) => lower.includes(word))) return "housing";
  if (GIG_WORDS.some((word) => lower.includes(word))) return "gig";
  if (MARKET_WORDS.some((word) => lower.includes(word))) return "market";
  return "general";
}

/**
 * findArea
 * WHAT: Picks out a DELSU area if the student mentioned one.
 * WHY : Area is the strongest filter for housing - Ekrejeta and Igun are very
 *       different experiences.
 */
function findArea(text: string, areas: string[]): string {
  const lower = text.toLowerCase();
  // Match case-insensitively against THIS institution's area list.
  return areas.find((area) => lower.includes(area.toLowerCase())) ?? "";
}

/**
 * detectPreference
 * WHAT: Pulls out hard requirements such as borehole water or a prepaid meter.
 * WHY : These become database filters, so we only accept known keywords.
 */
function detectPreferences(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  if (lower.includes("borehole") || lower.includes("water")) found.push("borehole");
  if (lower.includes("prepaid")) found.push("prepaid");
  if (lower.includes("postpaid")) found.push("postpaid");
  if (lower.includes("generator") && lower.includes("estate")) found.push("generator");
  if (lower.includes("verified") || lower.includes("safe")) found.push("verified");
  if (lower.includes("close") || lower.includes("near") || lower.includes("gate")) found.push("close-to-gate");
  if (lower.includes("furnished")) found.push("furnished");
  if (lower.includes("quiet")) found.push("quiet");

  return found;
}

/**
 * detectMonths
 * WHAT: Works out how many months of rent the student means.
 * WHY : "a year of rent" and "monthly" produce very different totals.
 */
function detectMonths(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes("per year") || lower.includes("a year") || lower.includes("annually") || lower.includes("yearly")) return 12;
  if (lower.includes("6 month") || lower.includes("six month")) return 6;
  if (lower.includes("3 month") || lower.includes("three month")) return 3;
  if (lower.includes("per month") || lower.includes("monthly") || lower.includes("a month")) return 1;
  return 0; // Unknown - the matcher will show both monthly and annual.
}

/**
 * parseIntentLocally
 * WHAT: The full local parser. Returns the same ParsedIntent shape as Claude.
 * WHY : This is the safety net that keeps the AI Budget Assistant alive when
 *       the AI provider is unreachable.
 */
export function parseIntentLocally(prompt: string, areas: string[] = []): ParsedIntent {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const money = extractMoney(text);

  // --- Total budget --------------------------------------------------------
  // Usually the first amount, or the one after "i have".
  let totalBudgetKobo = 0;
  const haveMatch = lower.match(/(?:i\s+have|i\s+got|with|budget(?:\s+of)?|i\s+can\s+spend)\s*[:\-]?\s*/);
  const haveIndex = haveMatch?.index ?? -1;
  if (haveIndex >= 0) {
    const afterHave = money.find((entry) => entry.kobo > 0 && text.toLowerCase().indexOf("") >= 0);
    // Prefer an amount that appears after the words "I have".
    const candidate = money.find((entry) => text.toLowerCase().lastIndexOf(entry.context) >= haveIndex);
    totalBudgetKobo = (candidate ?? afterHave)?.kobo ?? 0;
  }
  if (totalBudgetKobo === 0 && money.length > 0) {
    // If they only mentioned amounts attached to needs, use the largest as the
    // working budget so we can still tell them if they can afford things.
    totalBudgetKobo = Math.max(...money.map((entry) => entry.kobo));
  }

  // --- Needs ---------------------------------------------------------------
  const needs: ParsedIntent["needs"] = [];

  for (const entry of money) {
    const category = classify(entry.context);
    // Skip the amount we already treated as the total budget when it is clearly
    // just "I have X" with no item attached.
    if (category === "general" && entry.kobo === totalBudgetKobo && needs.length === 0) continue;

    // Pull a short description out of the context, e.g. "a standing fan".
    const words = entry.context
      .replace(/under|below|less than|max|maximum|about|around|for|need|want|looking\s+for|a\s|an\s|the\s/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const description = words.slice(-40) || category;

    needs.push({
      category,
      description,
      maxKobo: entry.kobo,
      area: findArea(entry.context, areas) || findArea(text, areas),
      months: category === "housing" ? detectMonths(text) : 0,
    });
  }

  // If the sentence clearly mentions a category but had no amount attached
  // (e.g. "I need a fan"), add it with no limit so we still search.
  const mentionedCategory = classify(text);
  if (needs.length === 0 && mentionedCategory !== "general") {
    needs.push({
      category: mentionedCategory,
      description: text.slice(0, 60),
      maxKobo: totalBudgetKobo,
      area: findArea(text, areas),
      months: mentionedCategory === "housing" ? detectMonths(text) : 0,
    });
  }

  // Deduplicate needs with the same category + description.
  const uniqueNeeds = needs.filter(
    (need, index) => needs.findIndex((n) => n.category === need.category && n.description === need.description) === index
  );

  const wantsRoommate = /roommate|share|split|group of|two of us|three of us|four of us/.test(lower);

  return {
    totalBudgetKobo,
    needs: uniqueNeeds.slice(0, 6),
    preferences: detectPreferences(text),
    wantsRoommate,
    summary: uniqueNeeds.length > 0
      ? `Got it - looking for ${uniqueNeeds.map((n) => n.description).join(" and ")}.`
      : totalBudgetKobo > 0
        ? `Got it - you have a budget to work with.`
        : "Tell me an amount or what you need and I will find real options.",
  };
}
