/**
 * src/app/api/roommates/matches/route.ts
 * WHAT: Finds students who would live well with the signed-in user, with a
 *       compatibility score and the reasons behind it.
 * WHY : This is the "advanced roommate matching" feature. The scoring runs on the
 *       server over real profiles - never guessed, never random.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { sortByCompatibility, type ProfileWithUser } from "@/lib/compatibility";
import { json, fail, handleError } from "@/lib/api";

/** How many matches to return. Enough to choose from, small enough for mobile. */
const MAX_MATCHES = 20;

/**
 * GET /api/roommates/matches?area=Ekrejeta&minScore=60
 * Returns the best matches, best first.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    // The user must have completed the questionnaire first.
    const myProfile = await prisma.roommateProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } },
      },
    });
    if (!myProfile) {
      return fail("Complete the roommate questionnaire first - it takes about a minute.", 400);
    }

    // SAME-GENDER RULE: matching needs a recorded gender on both sides.
    if (!user.gender) {
      return fail("Update your questionnaire with your gender - matching is same-gender only.", 400);
    }

    const url = new URL(request.url);
    const area = url.searchParams.get("area")?.trim() ?? "";
    const minScore = Number(url.searchParams.get("minScore") ?? "0");

    // Fetch candidates: verified students, not me, optionally in one area.
    const candidates = await prisma.roommateProfile.findMany({
      where: {
        userId: { not: user.id },
        // Silo + same-gender enforced right in the database query.
        user: {
          role: "STUDENT",
          isVerified: true,
          gender: user.gender,
          institutionId: user.institutionId,
        },
        ...(area ? { preferredAreas: { has: area } } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, gender: true, level: true, department: true, avatarUrl: true, bio: true, isVerified: true } },
      },
      take: 200, // Score a decent pool, then keep the best.
    });

    const ranked = sortByCompatibility(myProfile as ProfileWithUser, candidates as ProfileWithUser[]);

    // Keep only matches above the requested threshold.
    const matches = ranked
      .filter((entry) => entry.result.score >= minScore)
      .slice(0, MAX_MATCHES)
      .map(({ profile, result }) => ({
        userId: profile.user.id,
        fullName: profile.user.fullName,
        avatarUrl: profile.user.avatarUrl,
        level: profile.user.level,
        department: profile.user.department,
        isVerified: profile.user.isVerified,
        bio: profile.user.bio,
        score: result.score,
        label: result.label,
        reasons: result.reasons,
        warnings: result.warnings,
        budgetKobo: profile.budgetKobo,
        preferredAreas: profile.preferredAreas,
        sleepSchedule: profile.sleepSchedule,
        cleanliness: profile.cleanliness,
        noiseTolerance: profile.noiseTolerance,
      }));

    return json({ matches, myProfile });
  } catch (error) {
    return handleError(error);
  }
}
