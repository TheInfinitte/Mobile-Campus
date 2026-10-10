/**
 * src/app/api/institution/route.ts
 * WHAT: Returns the institution the current viewer belongs to (or the platform
 *       default for guests), including its community/area names.
 * WHY : Client components (filters, forms, the campus label in the header) all
 *       need the viewer's campus and its areas without each of them doing a
 *       server round-trip of their own.
 */
import { NextResponse } from "next/server";
import { json, handleError } from "@/lib/api";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/institution
 * Returns: { data: { id, name, shortName, type, city, state, areas } }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const institution = await getViewerInstitution();
    return json({
      id: institution.id,
      name: institution.name,
      shortName: institution.shortName,
      type: institution.type,
      city: institution.city,
      state: institution.state,
      areas: institution.areas,
    });
  } catch (error) {
    return handleError(error);
  }
}
