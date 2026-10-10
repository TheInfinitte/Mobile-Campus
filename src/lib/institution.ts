/**
 * src/lib/institution.ts
 * WHAT: Server-only helpers that resolve WHICH institution a request belongs
 *       to - the viewer's own school when signed in, otherwise the platform
 *       default (first active institution).
 * WHY : Every student-facing query must be siloed by institution. Centralising
 *       the resolution here means every route applies the same rule, and a
 *       logged-out visitor still sees a sensible campus (the default one).
 *
 * NOTE: this module imports auth (which reads cookies), so it must only be
 *       imported from API routes and server components - never from a
 *       "use client" file.
 */

import type { Institution } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError, getSessionUser } from "./auth";

/**
 * getDefaultInstitution
 * WHAT: The first active institution, ordered by creation date.
 * WHY : Logged-out browsing and seed-dependent defaults need ONE campus to
 *       show. The oldest active institution is the original launch campus.
 */
export async function getDefaultInstitution(): Promise<Institution> {
  const institution = await prisma.institution.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!institution) {
    // The seed always creates at least one institution; if none exists the
    // database has not been seeded, so say exactly that.
    throw new ApiError(500, "No active institution found. Run: npm run db:seed");
  }
  return institution;
}

/**
 * getViewerInstitution
 * WHAT: The institution the current viewer belongs to.
 * WHY : Signed-in users only ever see their own school's content; guests see
 *       the default campus. Returns the full row so callers get `areas`.
 */
export async function getViewerInstitution(): Promise<Institution> {
  const user = await getSessionUser();
  if (!user) return getDefaultInstitution();
  const institution = await prisma.institution.findUnique({ where: { id: user.institutionId } });
  // A user's institution should always exist; fall back defensively.
  return institution ?? getDefaultInstitution();
}

/**
 * getInstitutionAreas
 * WHAT: Convenience - just the community/area names for the viewer.
 * WHY : Filters and forms only need the names, not the whole row.
 */
export async function getInstitutionAreas(): Promise<string[]> {
  const institution = await getViewerInstitution();
  return institution.areas;
}
