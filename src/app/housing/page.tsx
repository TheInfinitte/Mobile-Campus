/**
 * src/app/housing/page.tsx
 * WHAT: The verified off-campus housing screen.
 * WHY : It is a server component that loads the first page of lodges (so the
 *       screen is never blank on a slow connection) and hands the interactive
 *       filtering to the HousingBrowser client component.
 */
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { FloatingBudgetButton } from "@/components/layout/FloatingBudgetButton";
import { HousingBrowser } from "@/components/housing/HousingBrowser";
import { type LodgeFilterValues } from "@/components/housing/LodgeFilters";
import { lodgeWhere, lodgeOrderBy, paginate, PAGE_SIZE } from "@/lib/search";
import { housingFeeBreakdown } from "@/lib/fees";
import { getViewerInstitution } from "@/lib/institution";
import { safeParse, lodgeFilterSchema } from "@/lib/validators";

export const metadata = { title: "Verified housing near DELSU" };
/** Prices and availability change constantly, so always render fresh. */
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Record<string, string | string[] | undefined> };

/**
 * HousingPage
 * WHAT: Reads the filters from the URL, loads page 1, renders the browser.
 * WHY : Reading filters from the URL means a shared link opens with the same
 *       results the sender saw.
 */
export default async function HousingPage({ searchParams }: PageProps) {
  // Validate the incoming query string with the same schema the UI uses.
  const parsed = safeParse(lodgeFilterSchema, searchParams);
  // If the URL contains something invalid we fall back to a clean, safe default
  // rather than rejecting the page.
  const filter = parsed.ok
    ? parsed.data
    : {
        q: "",
        area: "",
        minRentKobo: undefined,
        maxRentKobo: undefined,
        roomType: "",
        water: undefined,
        meter: undefined,
        maxDistanceMeters: undefined,
        verifiedOnly: true,
        sort: "relevance" as const,
        page: 1,
      };

  const { skip, take } = paginate(filter.page, PAGE_SIZE);

  // MULTI-CAMPUS SILO: only lodges from the viewer's own institution.
  const institution = await getViewerInstitution();

  // Page 1 of results, plus the fee ratio so every card can show a true total.
  const [total, rows, feeRules] = await Promise.all([
    prisma.lodge.count({ where: lodgeWhere(filter, institution.id) }),
    prisma.lodge.findMany({
      where: lodgeWhere(filter, institution.id),
      orderBy: lodgeOrderBy(filter.sort),
      skip,
      take,
      include: { images: { where: { isCover: true }, take: 1 } },
    }),
    housingFeeBreakdown(100_000),
  ]);

  const feeRatio = feeRules.payerFeeKobo / 100_000;

  // Mirror the server filter state back into the client component.
  const initialFilters: LodgeFilterValues = {
    q: filter.q ?? "",
    area: filter.area ?? "",
    minRent: filter.minRentKobo ? String(filter.minRentKobo / 100) : "",
    maxRent: filter.maxRentKobo ? String(filter.maxRentKobo / 100) : "",
    roomType: filter.roomType ?? "",
    water: filter.water ?? "",
    meter: filter.meter ?? "",
    maxDistance: filter.maxDistanceMeters ? String(filter.maxDistanceMeters) : "",
    sort: filter.sort,
    verifiedOnly: filter.verifiedOnly ?? true,
  };

  return (
    <PageTransition>
      <PageHeader
        title="Housing"
        subtitle="Verified lodges around DELSU, Abraka. Water, light and distance are checked."
      />

      <HousingBrowser
        initial={{
          lodges: rows.map((lodge) => ({
            id: lodge.id,
            title: lodge.title,
            area: lodge.area,
            roomType: lodge.roomType,
            monthlyRentKobo: lodge.monthlyRentKobo,
            annualRentKobo: lodge.annualRentKobo,
            waterSource: lodge.waterSource,
            meterType: lodge.meterType,
            distanceToMainGateMeters: lodge.distanceToMainGateMeters,
            ratingAverage: lodge.ratingAverage,
            ratingCount: lodge.ratingCount,
            isVerified: lodge.isVerified,
            coverImage: lodge.images[0]?.url ?? null,
            availableRooms: lodge.availableRooms,
          })),
          total,
          page: filter.page,
          pageSize: take,
        }}
        initialFilters={initialFilters}
      />

      {/* The AI assistant floats over this page, as the spec requires. */}
      <FloatingBudgetButton />
    </PageTransition>
  );
}
