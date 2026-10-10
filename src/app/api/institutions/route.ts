/**
 * src/app/api/institutions/route.ts
 * WHAT: Public list of active institutions for the sign-up "pick your school"
 *       screen.
 * WHY : Registration requires choosing an institution, and the list must come
 *       from the database so adding a campus never needs a code change.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/api";

/**
 * GET /api/institutions
 * Returns: { data: { institutions: [...] } }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const institutions = await prisma.institution.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        type: true,
        city: true,
        state: true,
        // SEARCHABLE ONBOARDING: the autocomplete matches these extra words
        // too, so "Abraka" or "Delta State" finds DELSU instantly.
        searchAliases: true,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return json({ institutions });
  } catch (error) {
    return handleError(error);
  }
}
