/**
 * src/lib/compatibility.ts
 * WHAT: Calculates how well two students would live together (0-100) and
 *       explains why, in plain English.
 * WHY : The roommate matcher is a headline feature. A single number plus one or
 *       two honest reasons ("You both read at night") is far more useful than a
 *       mystery percentage.
 *
 * THE WEIGHTS (add up to 100):
 *   Sleep schedule   30  - the biggest source of roommate conflict
 *   Cleanliness      20
 *   Noise tolerance  15
 *   Budget match     15
 *   Study style      10
 *   Smoking           5
 *   Pets              5
 */
import type { RoommateProfile, User } from "@prisma/client";

/** A profile joined with its owner, which is what the matcher needs. */
export type ProfileWithUser = RoommateProfile & {
  user: Pick<User, "id" | "fullName" | "gender" | "level" | "department" | "avatarUrl" | "bio" | "isVerified">;
};

/**
 * isSameGenderPair
 * WHAT: True only when both students have a recorded gender and it matches.
 * WHY : Same-gender pairing is a strict safety rule. If either gender is
 *       missing we cannot guarantee the rule, so the pair is NOT allowed.
 */
export function isSameGenderPair(aGender: string | null | undefined, bGender: string | null | undefined): boolean {
  const a = aGender?.toLowerCase();
  const b = bGender?.toLowerCase();
  return !!a && !!b && a === b;
}

/** The score plus the reasons behind it. */
export type CompatibilityResult = {
  score: number;        // 0 to 100
  label: string;        // "Excellent match", "Good match", ...
  reasons: string[];    // Short human explanations.
  warnings: string[];   // Things to discuss before moving in together.
};

/**
 * distanceScore
 * WHAT: Turns the gap between two 1-5 ratings into a 0-1 score.
 * WHY : A gap of 0 is perfect (1.0), a gap of 4 is the worst possible (0.0).
 */
function distanceScore(a: number, b: number): number {
  const gap = Math.abs(a - b);
  return Math.max(0, 1 - gap / 4);
}

/**
 * compatibility
 * WHAT: Compares two roommate profiles and returns a score with explanations.
 * WHY : Used by the matches screen and when someone applies to a roommate post.
 */
export function compatibility(a: ProfileWithUser, b: ProfileWithUser): CompatibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // --- Sleep schedule (30 points) -----------------------------------------
  let sleepScore = 0;
  if (a.sleepSchedule === b.sleepSchedule) {
    sleepScore = 1;
    reasons.push(
      a.sleepSchedule === "night-reader"
        ? "You both read late at night."
        : a.sleepSchedule === "early-sleeper"
          ? "You both sleep early, so the room stays quiet."
          : "You are both flexible about sleep times."
    );
  } else if (a.sleepSchedule === "flexible" || b.sleepSchedule === "flexible") {
    sleepScore = 0.75; // One person adapts - usually workable.
    reasons.push("One of you is flexible about sleep times.");
  } else {
    sleepScore = 0.15; // Night reader + early sleeper is the classic clash.
    warnings.push("One of you reads at night while the other sleeps early - agree on a lamp rule.");
  }

  // --- Cleanliness (20 points) --------------------------------------------
  const cleanScore = distanceScore(a.cleanliness, b.cleanliness);
  if (cleanScore >= 0.75) reasons.push("You have similar cleanliness standards.");
  if (cleanScore <= 0.25) warnings.push("You rate cleanliness very differently - agree on a cleaning rota.");

  // --- Noise tolerance (15 points) ----------------------------------------
  const noiseScore = distanceScore(a.noiseTolerance, b.noiseTolerance);
  if (noiseScore <= 0.25) warnings.push("One of you needs a quiet room more than the other.");

  // --- Budget match (15 points) -------------------------------------------
  // Compare the higher budget against the lower one. Close budgets are easier.
  const highBudget = Math.max(a.budgetKobo, b.budgetKobo);
  const lowBudget = Math.max(1, Math.min(a.budgetKobo, b.budgetKobo));
  const budgetScore = Math.max(0, 1 - (highBudget - lowBudget) / highBudget);
  if (budgetScore >= 0.9) reasons.push("Your rent budgets are almost the same.");
  if (budgetScore <= 0.5) warnings.push("Your budgets are far apart - you may be looking at different lodges.");

  // --- Study style (10 points) --------------------------------------------
  const studyScore = a.studyStyle === b.studyStyle ? 1 : a.studyStyle === "library" || b.studyStyle === "library" ? 0.7 : 0.45;

  // --- Smoking and pets (5 points each) -----------------------------------
  const smokeScore = a.smokes === b.smokes ? 1 : 0;
  if (a.smokes !== b.smokes) warnings.push("One of you smokes and the other does not.");
  const petScore = a.hasPets === b.hasPets ? 1 : 0;
  if (a.hasPets !== b.hasPets) warnings.push("One of you has a pet.");

  // Weighted total, rounded to a whole percentage.
  const raw =
    sleepScore * 30 +
    cleanScore * 20 +
    noiseScore * 15 +
    budgetScore * 15 +
    studyScore * 10 +
    smokeScore * 5 +
    petScore * 5;

  const score = Math.round(raw);

  // HARD RULE: roommate pairing is strictly same-gender. A mismatch (or a
  // missing gender) zeroes the score so such pairs can never match.
  const genderOk = isSameGenderPair(a.user.gender, b.user.gender);
  if (!genderOk) {
    warnings.push("Matching is same-gender only for safety and privacy.");
  }

  return {
    score: genderOk ? score : 0,
    label: labelFor(genderOk ? score : 0),
    reasons,
    warnings,
  };
}

/**
 * labelFor
 * WHAT: Turns a score into a friendly label.
 * WHY : "87" means nothing on its own; "Excellent match" is instant.
 */
export function labelFor(score: number): string {
  if (score >= 85) return "Excellent match";
  if (score >= 70) return "Great match";
  if (score >= 55) return "Good match";
  if (score >= 40) return "Possible match";
  return "Not a great match";
}

/**
 * sortByCompatibility
 * WHAT: Sorts a list of profiles against mine, best first.
 * WHY : The matches screen shows the most compatible people at the top.
 */
export function sortByCompatibility(
  me: ProfileWithUser,
  others: ProfileWithUser[]
): { profile: ProfileWithUser; result: CompatibilityResult }[] {
  return others
    // Never match a person with themselves.
    .filter((other) => other.userId !== me.userId)
    // Strict same-gender rule: opposite or unknown genders are never shown.
    .filter((other) => isSameGenderPair(me.user.gender, other.user.gender))
    .map((profile) => ({ profile, result: compatibility(me, profile) }))
    .sort((a, b) => b.result.score - a.result.score);
}
