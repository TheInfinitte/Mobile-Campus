/**
 * src/lib/search.ts
 * WHAT: Builds Prisma "where" filters and sorting for the housing, market and
 *       gig search screens.
 * WHY : The search UI, the API routes and the AI assistant all need to filter
 *       the same tables the same way. One shared builder stops them drifting
 *       apart and keeps the SQL safe (Prisma parameterises every value).
 */
import type { Prisma } from "@prisma/client";
import type { lodgeFilterSchema, marketFilterSchema, gigFilterSchema } from "./validators";
import { z } from "zod";

/** How many cards fit on one page on a phone. */
export const PAGE_SIZE = 12;

/** The parsed shape of the housing filter. */
export type LodgeFilter = z.infer<typeof lodgeFilterSchema>;
export type MarketFilter = z.infer<typeof marketFilterSchema>;
export type GigFilter = z.infer<typeof gigFilterSchema>;

/**
 * lodgeWhere
 * WHAT: Turns housing filters into a Prisma where clause.
 * WHY : Keeps every filter option in one readable place, and guarantees we
 *       only ever return ACTIVE lodges.
 */
export function lodgeWhere(filter: LodgeFilter, institutionId: string): Prisma.LodgeWhereInput {
  // Free-text search looks at the title, description and area.
  const search = filter.q?.trim();

  return {
    // MULTI-CAMPUS SILO: students only ever see lodges from their own school.
    institutionId,
    status: "ACTIVE",
    // Only show verified lodges unless the user explicitly opts out (they cannot).
    ...(filter.verifiedOnly ? { isVerified: true } : {}),
    ...(filter.area ? { area: { equals: filter.area, mode: "insensitive" } } : {}),
    ...(filter.roomType ? { roomType: filter.roomType as Prisma.LodgeWhereInput["roomType"] } : {}),
    ...(filter.water ? { waterSource: filter.water } : {}),
    ...(filter.meter ? { meterType: filter.meter } : {}),
    // Monthly rent must sit inside the chosen range.
    ...(filter.minRentKobo || filter.maxRentKobo
      ? {
          monthlyRentKobo: {
            ...(filter.minRentKobo ? { gte: filter.minRentKobo } : {}),
            ...(filter.maxRentKobo ? { lte: filter.maxRentKobo } : {}),
          },
        }
      : {}),
    // Distance from the campus main gate.
    ...(filter.maxDistanceMeters
      ? { distanceToMainGateMeters: { lte: filter.maxDistanceMeters, not: null } }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { area: { contains: search, mode: "insensitive" as const } },
            { address: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/**
 * lodgeOrderBy
 * WHAT: Chooses the sort order for housing results.
 * WHY : "Cheapest first", "closest first" and "best rated" are the three sorts
 *       students actually use.
 */
export function lodgeOrderBy(sort: LodgeFilter["sort"]): Prisma.LodgeOrderByWithRelationInput[] {
  // MONETISATION HOOK: sponsored listings sit above organic results.
  const sponsoredFirst = [{ isSponsored: "desc" as const }];
  switch (sort) {
    case "price-asc":
      return [...sponsoredFirst, { monthlyRentKobo: "asc" }];
    case "price-desc":
      return [...sponsoredFirst, { monthlyRentKobo: "desc" }];
    case "rating":
      // Highest rating first; lodges with no reviews fall to the bottom.
      return [...sponsoredFirst, { ratingCount: "desc" }, { ratingAverage: "desc" }];
    case "distance":
      // nulls last: Prisma sorts nulls first by default in Postgres.
      return [{ distanceToMainGateMeters: { sort: "asc", nulls: "last" } }];
    default:
      // "relevance": verified and well-rated lodges first, then newest.
      return [{ isVerified: "desc" }, { ratingAverage: "desc" }, { createdAt: "desc" }];
  }
}

/**
 * marketWhere
 * WHAT: Marketplace filters.
 * WHY : Includes the "Graduating Student Drop" toggle, which is a headline
 *       section of the market.
 */
export function marketWhere(filter: MarketFilter, institutionId: string): Prisma.MarketItemWhereInput {
  const search = filter.q?.trim();
  return {
    // MULTI-CAMPUS SILO: only items from the viewer's own school.
    institutionId,
    // Never show items that are already sold or removed.
    status: { in: ["AVAILABLE", "RESERVED"] },
    ...(filter.category ? { category: { equals: filter.category, mode: "insensitive" } } : {}),
    ...(filter.area ? { area: { equals: filter.area, mode: "insensitive" } } : {}),
    ...(filter.graduatingOnly ? { isGraduatingDrop: true } : {}),
    ...(filter.minKobo || filter.maxKobo
      ? {
          priceKobo: {
            ...(filter.minKobo ? { gte: filter.minKobo } : {}),
            ...(filter.maxKobo ? { lte: filter.maxKobo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/**
 * marketOrderBy
 * WHAT: Marketplace sorting (newest, cheapest, dearest).
 * WHY : Graduating drops are time-sensitive, so "newest" is the default.
 */
export function marketOrderBy(sort: MarketFilter["sort"]): Prisma.MarketItemOrderByWithRelationInput[] {
  // MONETISATION HOOK: sponsored items sit above organic results.
  const sponsoredFirst = [{ isSponsored: "desc" as const }];
  switch (sort) {
    case "price-asc":
      return [...sponsoredFirst, { priceKobo: "asc" }];
    case "price-desc":
      return [...sponsoredFirst, { priceKobo: "desc" }];
    default:
      return [...sponsoredFirst, { createdAt: "desc" }];
  }
}

/**
 * gigWhere
 * WHAT: Micro-gig filters.
 * WHY : Only OPEN tasks are shown; an already-taken job would waste a student's
 *       time.
 */
export function gigWhere(filter: GigFilter, institutionId: string): Prisma.GigWhereInput {
  const search = filter.q?.trim();
  return {
    // MULTI-CAMPUS SILO: only gigs from the viewer's own school.
    institutionId,
    status: "OPEN",
    // BIDIRECTIONAL BOARD: show only the requested side (wanted/offered).
    ...(filter.gigType ? { gigType: filter.gigType } : {}),
    ...(filter.category ? { category: { equals: filter.category, mode: "insensitive" } } : {}),
    ...(filter.area ? { area: { equals: filter.area, mode: "insensitive" } } : {}),
    ...(filter.minKobo || filter.maxKobo
      ? {
          budgetKobo: {
            ...(filter.minKobo ? { gte: filter.minKobo } : {}),
            ...(filter.maxKobo ? { lte: filter.maxKobo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/**
 * gigOrderBy
 * WHAT: Gig sorting.
 * WHY : Same three options as the market for consistency.
 */
export function gigOrderBy(sort: GigFilter["sort"]): Prisma.GigOrderByWithRelationInput[] {
  // MONETISATION HOOK: sponsored posts always sit at the top of the board.
  const sponsoredFirst = [{ isSponsored: "desc" as const }];
  switch (sort) {
    case "price-asc":
      return [...sponsoredFirst, { budgetKobo: "asc" }];
    case "price-desc":
      return [...sponsoredFirst, { budgetKobo: "desc" }];
    default:
      return [...sponsoredFirst, { createdAt: "desc" }];
  }
}

/**
 * errandWhere
 * WHAT: Errand board filters - open tasks only, siloed by institution,
 *       optionally narrowed by a non-food category or a keyword.
 */
export function errandWhere(
  filter: { q?: string; category?: string },
  institutionId: string
): Prisma.ErrandWhereInput {
  const search = filter.q?.trim();
  return {
    institutionId,
    status: "OPEN",
    ...(filter.category ? { category: { equals: filter.category, mode: "insensitive" } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { pickupPoint: { contains: search, mode: "insensitive" } },
            { dropOffPoint: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/**
 * errandOrderBy
 * WHAT: Errand sorting - sponsored first, then the chosen order.
 */
export function errandOrderBy(sort: "newest" | "fee-asc" | "fee-desc"): Prisma.ErrandOrderByWithRelationInput[] {
  switch (sort) {
    case "fee-asc":
      return [{ isSponsored: "desc" }, { feeKobo: "asc" }];
    case "fee-desc":
      return [{ isSponsored: "desc" }, { feeKobo: "desc" }];
    default:
      return [{ isSponsored: "desc" }, { createdAt: "desc" }];
  }
}

/**
 * paginate
 * WHAT: Works out skip/take from a page number.
 * WHY : Pagination keeps the data transfer small, which matters on mobile data.
 */
export function paginate(page: number, pageSize = PAGE_SIZE): { skip: number; take: number } {
  const safePage = Math.max(1, page || 1);
  return { skip: (safePage - 1) * pageSize, take: pageSize };
}
