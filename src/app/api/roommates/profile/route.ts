/**
 * src/app/api/roommates/profile/route.ts
 * WHAT: Reads and saves the roommate questionnaire answers for the signed-in user.
 * WHY : The questionnaire is what powers the compatibility score. Saving it as a
 *       separate profile means a student can update their habits without touching
 *       their account.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, roommateProfileSchema } from "@/lib/validators";

/**
 * GET /api/roommates/profile
 * Returns the signed-in user's roommate profile (or null if they have not filled it in).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const profile = await prisma.roommateProfile.findUnique({ where: { userId: user.id } });
    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/roommates/profile
 * Body: the questionnaire answers.
 * Creates or updates the profile (upsert) so the form works for both first-timers
 * and returning users.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(roommateProfileSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // Only students match with roommates.
    if (user.role !== "STUDENT") return fail("The roommate board is for students.", 403);

    // Gender lives on the USER (not the profile) because every matching query
    // enforces same-gender pairing right in the database filter.
    const { gender, ...profileData } = parsed.data;
    await prisma.user.update({ where: { id: user.id }, data: { gender } });

    const profile = await prisma.roommateProfile.upsert({
      where: { userId: user.id },
      update: { ...profileData },
      create: { userId: user.id, ...profileData },
    });

    return json({ profile });
  } catch (error) {
    return handleError(error);
  }
}
