/**
 * src/types/budget.ts
 * WHAT: The shared shapes used by the AI Budget Assistant - what the AI parses,
 *       what we find in the database, and the final plan we show the user.
 * WHY : The AI parsing code, the database matching code and the UI cards must
 *       all agree on the same structure. Defining it once prevents drift.
 */

/** The categories a student can ask the assistant about. */
export type BudgetCategory =
  | "housing"   // A lodge / room to rent.
  | "market"    // Something to buy (fan, mattress, generator...).
  | "gig"       // A service to hire (laundry, hair, food run...).
  | "general";  // Not a specific category (e.g. "I have 150k").

/**
 * ParsedIntent
 * WHAT: The strict JSON that Claude must return.
 * WHY : We never let free text reach the database query. The AI's only job is
 *       to turn "I need a room under 80k and a fan under 15k" into numbers and
 *       filters. If the AI misbehaves we fall back to our own regex parser.
 */
export type ParsedIntent = {
  /** Total money the student says they have, in kobo. 0 if they did not say. */
  totalBudgetKobo: number;
  /** What the student wants, with a per-item budget if they gave one. */
  needs: {
    category: BudgetCategory;
    /** Free-text description of the item, e.g. "standing fan". */
    description: string;
    /** Maximum they want to spend on this one thing, in kobo. 0 = no limit. */
    maxKobo: number;
    /** Preferred area, e.g. "Ekrejeta". Empty string = anywhere. */
    area: string;
    /** For housing only: how many months of rent they mean. */
    months: number;
  }[];
  /** Any hard requirements, e.g. ["borehole", "prepaid meter", "under 1km"]. */
  preferences: string[];
  /** True if the student mentioned wanting to share with a roommate. */
  wantsRoommate: boolean;
  /** A friendly one-line summary of what the AI understood. */
  summary: string;
};

/** A lodge matched to the student's budget. */
export type MatchedLodge = {
  id: string;
  title: string;
  area: string;
  roomType: string;
  monthlyRentKobo: number;
  annualRentKobo: number;
  cautionDepositKobo: number;
  waterSource: string;
  meterType: string;
  distanceToMainGateMeters: number | null;
  ratingAverage: number;
  ratingCount: number;
  isVerified: boolean;
  coverImage: string;
  /** Our calculated platform fee for this booking, in kobo. */
  feeKobo: number;
  /** Total the student would pay to move in, in kobo. */
  totalKobo: number;
  /** Why we chose it, e.g. "Within budget" or "Saves you ₦12,000". */
  fitLabel: string;
  /** 0-100: how well it matches everything they asked for. */
  fitScore: number;
};

/** A market item matched to the budget. */
export type MatchedItem = {
  id: string;
  title: string;
  category: string;
  area: string;
  priceKobo: number;
  condition: string;
  image: string;
  isGraduatingDrop: boolean;
  fitLabel: string;
  fitScore: number;
};

/** A gig matched to the budget. */
export type MatchedGig = {
  id: string;
  title: string;
  category: string;
  area: string;
  budgetKobo: number;
  fitLabel: string;
  fitScore: number;
};

/** The move-in money breakdown for a chosen lodge. */
export type HousingBreakdown = {
  lodgeId: string;
  lodgeTitle: string;
  rentKobo: number;         // Rent for the period chosen.
  cautionKobo: number;      // Refundable deposit.
  platformFeeKobo: number;  // The 1% tenant commission.
  moveInItemsKobo: number;  // Suggested fan, mattress, gas etc.
  totalKobo: number;        // Everything added up.
  affordable: boolean;      // Can they pay it with their stated budget?
  differenceKobo: number;   // Positive = leftover, negative = short by this.
  message: string;          // "You can afford this" / "You are short by ₦12,000".
  /** What sharing with a roommate would save them, in kobo. */
  splitWithRoommateKobo: number;
  splitMessage: string;
};

/**
 * BudgetPlan
 * WHAT: The complete answer we render on screen.
 * WHY : One object holds everything the animated result cards need, so the UI
 *       never has to call three different endpoints.
 */
export type BudgetPlan = {
  /** What we understood, in plain English. */
  summary: string;
  /** The structured intent (also shown to the user as editable chips). */
  intent: ParsedIntent;
  lodges: MatchedLodge[];
  items: MatchedItem[];
  gigs: MatchedGig[];
  /** Present when the student asked about housing. */
  breakdown?: HousingBreakdown;
  /** Smart suggestions, e.g. "Split a double self-contain with a roommate". */
  suggestions: string[];
  /** "AI" when Claude parsed it, "FALLBACK" when our own parser did. */
  source: "AI" | "FALLBACK";
  /** True when we could not find anything that fits. */
  empty: boolean;
};

/** The empty/default intent used when nothing could be parsed. */
export const emptyIntent: ParsedIntent = {
  totalBudgetKobo: 0,
  needs: [],
  preferences: [],
  wantsRoommate: false,
  summary: "",
};
