/**
 * src/lib/budget-match.ts
 * WHAT: The database side of the AI Budget Assistant. It takes a parsed intent
 *       and runs REAL Prisma queries against lodges, market items and gigs.
 * WHY : The product rule is absolute: the assistant never invents listings.
 *       Every card it shows comes from a row that exists in the database, and
 *       every price is the real stored price.
 */
import { prisma } from "./prisma";
import { housingFeeBreakdown } from "./fees";
import { formatNaira, formatNairaCompact } from "./money";
import { roomTypeLabel, WATER_LABELS, METER_LABELS } from "./data";
import type {
  BudgetPlan,
  HousingBreakdown,
  MatchedGig,
  MatchedItem,
  MatchedLodge,
  ParsedIntent,
} from "@/types/budget";

/** How many results of each type we show. Small on purpose for mobile. */
const MAX_LODGES = 6;
const MAX_ITEMS = 6;
const MAX_GIGS = 4;

/**
 * buildPlan
 * WHAT: Turns a parsed intent into a full BudgetPlan by querying the database.
 * WHY : This is the single function the budget API route calls. It keeps all
 *       the matching logic in one testable place.
 */
export async function buildPlan(intent: ParsedIntent, source: "AI" | "FALLBACK", institutionId: string): Promise<BudgetPlan> {
  const suggestions: string[] = [];

  // Pull the needs for each category out of the intent.
  const housingNeeds = intent.needs.filter((need) => need.category === "housing");
  const marketNeeds = intent.needs.filter((need) => need.category === "market");
  const gigNeeds = intent.needs.filter((need) => need.category === "gig");

  // If the student only said an amount ("I have 150k") we assume they want both
  // housing and market suggestions, because that is what almost everyone means.
  const wantsHousing = housingNeeds.length > 0 || intent.needs.length === 0;
  const wantsMarket = marketNeeds.length > 0 || intent.needs.length === 0;
  const wantsGigs = gigNeeds.length > 0;

  // ---------------------------------------------------------------------
  // 1. LODGES
  // ---------------------------------------------------------------------
  const lodges: MatchedLodge[] = [];
  let breakdown: HousingBreakdown | undefined;

  if (wantsHousing) {
    // The budget for housing: the need's own limit, or the total budget.
    const housingBudget = housingNeeds[0]?.maxKobo || intent.totalBudgetKobo || 0;
    const area = housingNeeds[0]?.area || intent.needs.find((n) => n.area)?.area || "";
    const months = housingNeeds[0]?.months || 12;

    // Build a Prisma filter from the intent. Only known, safe values are used.
    const where = {
      // MULTI-CAMPUS SILO: suggestions only come from the student's own school.
      institutionId,
      status: "ACTIVE" as const,
      isVerified: true, // Only show verified lodges to keep students safe.
      ...(area ? { area: { equals: area, mode: "insensitive" as const } } : {}),
      // Leave 15% of the budget for caution fee + our fee + move-in items.
      ...(housingBudget > 0
        ? { monthlyRentKobo: { lte: Math.round((housingBudget / months) * 0.85) } }
        : {}),
    };

    const rows = await prisma.lodge.findMany({
      where,
      include: { images: { where: { isCover: true }, take: 1 } },
      orderBy: [{ monthlyRentKobo: "desc" }], // Best (biggest) rooms they can afford first.
      take: 30, // We fetch more than we show so the fit scoring can reorder them.
    });

    // Calculate the real 1% tenant fee once (it is a percentage, so it scales).
    const feeRules = await housingFeeBreakdown(100_000); // Base of ₦1,000 for a ratio.
    const tenantFeePercent = feeRules.payerFeeKobo / 100_000;

    for (const lodge of rows) {
      // Real money maths for this specific lodge.
      const rentForPeriod = months >= 12 ? lodge.annualRentKobo : lodge.monthlyRentKobo * months;
      const feeKobo = Math.max(50000, Math.round(rentForPeriod * tenantFeePercent)); // Minimum ₦500 fee.
      const totalKobo = rentForPeriod + lodge.cautionDepositKobo + feeKobo;

      // How well does it fit? Cheaper relative to budget = better fit, but we
      // also reward short distance and good ratings.
      let fitScore = 60;
      if (housingBudget > 0) {
        const ratio = totalKobo / housingBudget; // 1.0 means exactly the budget.
        fitScore = ratio <= 1 ? 70 + Math.round((1 - ratio) * 30) : Math.max(10, Math.round(70 - (ratio - 1) * 100));
      }
      if ((lodge.distanceToMainGateMeters ?? 9999) < 1000) fitScore += 5; // Walkable to the gate.
      if (lodge.waterSource === "BOREHOLE") fitScore += 4;               // Borehole is the most wanted.
      if (lodge.meterType === "PREPAID") fitScore += 3;                  // Prepaid avoids surprise bills.
      if (lodge.ratingAverage >= 4) fitScore += 3;
      fitScore = Math.min(99, fitScore);

      // The label the student sees on the card.
      let fitLabel = "Good option";
      if (housingBudget > 0) {
        if (totalKobo <= housingBudget) {
          const saved = housingBudget - totalKobo;
          fitLabel = saved > 100000 ? `Saves you ${formatNaira(saved)}` : "Within budget";
        } else {
          fitLabel = `Over by ${formatNaira(totalKobo - housingBudget)}`;
        }
      }

      lodges.push({
        id: lodge.id,
        title: lodge.title,
        area: lodge.area,
        roomType: roomTypeLabel(lodge.roomType),
        monthlyRentKobo: lodge.monthlyRentKobo,
        annualRentKobo: lodge.annualRentKobo,
        cautionDepositKobo: lodge.cautionDepositKobo,
        waterSource: WATER_LABELS[lodge.waterSource] ?? lodge.waterSource,
        meterType: METER_LABELS[lodge.meterType] ?? lodge.meterType,
        distanceToMainGateMeters: lodge.distanceToMainGateMeters,
        ratingAverage: lodge.ratingAverage,
        ratingCount: lodge.ratingCount,
        isVerified: lodge.isVerified,
        coverImage: lodge.images[0]?.url ?? "",
        feeKobo,
        totalKobo,
        fitLabel,
        fitScore,
      });
    }

    // Best fit first.
    lodges.sort((a, b) => b.fitScore - a.fitScore);

    // Build the detailed affordability breakdown for the best lodge.
    if (lodges.length > 0 && intent.totalBudgetKobo > 0) {
      breakdown = buildHousingBreakdown(lodges[0], intent);
    }
  }

  // ---------------------------------------------------------------------
  // 2. MARKET ITEMS
  // ---------------------------------------------------------------------
  const items: MatchedItem[] = [];

  if (wantsMarket) {
    // If the student named an item ("a fan"), search by its words.
    const searchWords = marketNeeds.map((need) => need.description).join(" ");
    const itemBudget = marketNeeds[0]?.maxKobo || 0;

    const rows = await prisma.marketItem.findMany({
      where: {
        institutionId,
        status: "AVAILABLE",
        ...(itemBudget > 0 ? { priceKobo: { lte: itemBudget } } : {}),
        ...(searchWords
          ? {
              OR: [
                { title: { contains: searchWords.split(" ").filter((w) => w.length > 2)[0] ?? "", mode: "insensitive" } },
                { category: { contains: searchWords.split(" ").filter((w) => w.length > 2)[0] ?? "", mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ isGraduatingDrop: "desc" }, { createdAt: "desc" }], // Graduating drops first - they are the best deals.
      take: 30,
    });

    for (const item of rows) {
      let fitScore = 65;
      if (itemBudget > 0 && item.priceKobo <= itemBudget) {
        fitScore = 75 + Math.round((1 - item.priceKobo / itemBudget) * 20);
      }
      if (item.isGraduatingDrop) fitScore += 6; // Graduating students sell fast and cheap.
      if (item.condition === "New") fitScore += 3;
      fitScore = Math.min(99, fitScore);

      const fitLabel =
        itemBudget > 0 && item.priceKobo <= itemBudget
          ? itemBudget - item.priceKobo > 500000
            ? `Saves you ${formatNaira(itemBudget - item.priceKobo)}`
            : "Within budget"
          : item.isGraduatingDrop
            ? "Graduating student drop"
            : "Good price";

      items.push({
        id: item.id,
        title: item.title,
        category: item.category,
        area: item.area,
        priceKobo: item.priceKobo,
        condition: item.condition,
        image: item.images[0] ?? "",
        isGraduatingDrop: item.isGraduatingDrop,
        fitLabel,
        fitScore,
      });
    }

    items.sort((a, b) => b.fitScore - a.fitScore);
  }

  // ---------------------------------------------------------------------
  // 3. GIGS
  // ---------------------------------------------------------------------
  const gigs: MatchedGig[] = [];

  if (wantsGigs) {
    const gigBudget = gigNeeds[0]?.maxKobo || intent.totalBudgetKobo || 0;
    const rows = await prisma.gig.findMany({
      where: {
        institutionId,
        status: "OPEN",
        ...(gigBudget > 0 ? { budgetKobo: { lte: gigBudget } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: MAX_GIGS,
    });

    for (const gig of rows) {
      gigs.push({
        id: gig.id,
        title: gig.title,
        category: gig.category,
        area: gig.area,
        budgetKobo: gig.budgetKobo,
        fitLabel: gigBudget > 0 && gig.budgetKobo <= gigBudget ? "Pays within your budget" : "Open task",
        fitScore: gigBudget > 0 ? Math.max(50, 95 - Math.round((gig.budgetKobo / gigBudget) * 20)) : 70,
      });
    }

    gigs.sort((a, b) => b.fitScore - a.fitScore);
  }

  // ---------------------------------------------------------------------
  // 4. SMART SUGGESTIONS
  // ---------------------------------------------------------------------
  if (breakdown && !breakdown.affordable) {
    suggestions.push(
      `You are short by ${formatNaira(Math.abs(breakdown.differenceKobo))}. Sharing a double self-contain with one roommate would save you about ${formatNaira(breakdown.splitWithRoommateKobo)}.`
    );
    suggestions.push("Check the Roommate Board - several students are already looking for someone to pair with.");
  }
  if (lodges.length > 1) {
    const cheapest = lodges.reduce((min, lodge) => (lodge.totalKobo < min.totalKobo ? lodge : min), lodges[0]);
    const dearest = lodges.reduce((max, lodge) => (lodge.totalKobo > max.totalKobo ? lodge : max), lodges[0]);
    if (cheapest.id !== dearest.id) {
      suggestions.push(
        `${cheapest.title} is ${formatNaira(dearest.totalKobo - cheapest.totalKobo)} cheaper than ${dearest.title} for the same kind of room.`
      );
    }
  }
  if (items.some((item) => item.isGraduatingDrop)) {
    suggestions.push("Graduating students are selling fast - the Graduating Student Drop section has the best prices right now.");
  }
  if (intent.wantsRoommate) {
    suggestions.push("Post on the Roommate Board and match with students who read at the same hours as you.");
  }
  if (suggestions.length === 0 && lodges.length > 0) {
    suggestions.push("Pay with escrow so your money is only released after you have moved in and checked the room.");
  }

  const empty = lodges.length === 0 && items.length === 0 && gigs.length === 0;

  return {
    summary:
      intent.summary ||
      (empty
        ? "I could not find anything that matches yet. Try a slightly higher budget or a different area."
        : "Here is what I found for you in the DELSU area."),
    intent,
    lodges: lodges.slice(0, MAX_LODGES),
    items: items.slice(0, MAX_ITEMS),
    gigs,
    breakdown,
    suggestions,
    source,
    empty,
  };
}

/**
 * buildHousingBreakdown
 * WHAT: Builds the rent + caution + fee + move-in items = total calculation for
 *       one lodge, compared with what the student said they have.
 * WHY : This is the most useful number on the whole screen. It answers the real
 *       question: "can I actually afford to move into this place?"
 */
function buildHousingBreakdown(lodge: MatchedLodge, intent: ParsedIntent): HousingBreakdown {
  // Suggested move-in items: a fan, a mattress and a gas cylinder are the three
  // things nearly every DELSU student needs on day one.
  const moveInItemsKobo = 1_500_000 + 2_800_000 + 3_200_000; // ₦15k fan + ₦28k mattress + ₦32k gas.

  const totalKobo = lodge.annualRentKobo + lodge.cautionDepositKobo + lodge.feeKobo + moveInItemsKobo;
  const budget = intent.totalBudgetKobo;
  const differenceKobo = budget - totalKobo;
  const affordable = differenceKobo >= 0;

  // What splitting with one roommate would look like: rent and items are shared,
  // but the platform fee is charged per person.
  const sharedKobo = Math.round((lodge.annualRentKobo + moveInItemsKobo) / 2) + lodge.cautionDepositKobo + lodge.feeKobo;
  const splitSaving = totalKobo - sharedKobo;

  return {
    lodgeId: lodge.id,
    lodgeTitle: lodge.title,
    rentKobo: lodge.annualRentKobo,
    cautionKobo: lodge.cautionDepositKobo,
    platformFeeKobo: lodge.feeKobo,
    moveInItemsKobo,
    totalKobo,
    affordable,
    differenceKobo,
    message: affordable
      ? `You can afford this. You would have ${formatNaira(differenceKobo)} left over.`
      : `You are short by ${formatNaira(Math.abs(differenceKobo))} for this room.`,
    splitWithRoommateKobo: splitSaving,
    splitMessage: affordable
      ? `Sharing with one roommate would free up ${formatNaira(splitSaving)} for other things.`
      : `Sharing with one roommate brings it down to ${formatNairaCompact(sharedKobo)} for you.`,
  };
}
