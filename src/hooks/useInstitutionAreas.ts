/**
 * src/hooks/useInstitutionAreas.ts
 * WHAT: Client-side access to the viewer's institution community names.
 * WHY : Multi-campus: area options are no longer a global constant. Filters and
 *       forms call this one hook so every screen offers the same communities.
 */
"use client";

import { useFetch } from "./useFetch";

/** The slice of /api/institution this hook cares about. */
type InstitutionMeta = { areas: string[]; shortName: string; name: string };

/**
 * useInstitutionAreas
 * WHAT: Returns the area list for the signed-in viewer (or the default campus
 *       for guests), empty while loading.
 * WHY : Components must render sensibly before the fetch lands, so we return
 *       [] and let selects pick their first value in an effect.
 */
export function useInstitutionAreas(): string[] {
  const { data } = useFetch<InstitutionMeta>("/api/institution");
  return data?.areas ?? [];
}

/**
 * useInstitution
 * WHAT: The full viewer-institution meta (name + areas) for labels.
 * WHY : Headers and empty states want to say the campus name.
 */
export function useInstitution(): InstitutionMeta | null {
  const { data } = useFetch<InstitutionMeta>("/api/institution");
  return data;
}
