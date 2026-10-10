/**
 * src/app/market/page.tsx
 * WHAT: The P2P marketplace, including the Graduating Student Drop section.
 * WHY : Server-rendered so the list is visible immediately, with filters read
 *       from the URL so a filtered search can be shared.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { FloatingBudgetButton } from "@/components/layout/FloatingBudgetButton";
import { EmptyState } from "@/components/ui/Card";
import { BagIcon, CapIcon, PlusIcon } from "@/components/ui/Icons";
import { marketWhere, marketOrderBy, paginate, PAGE_SIZE } from "@/lib/search";
import { safeParse, marketFilterSchema } from "@/lib/validators";
import { MARKET_CATEGORIES } from "@/lib/data";
import { getViewerInstitution } from "@/lib/institution";

export const metadata = { title: "Student marketplace" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Record<string, string | string[] | undefined> };

/**
 * MarketPage
 * WHAT: Lists items, with a highlighted Graduating Student Drop strip at the top
 *       when that filter is not already active.
 */
export default async function MarketPage({ searchParams }: PageProps) {
  // MULTI-CAMPUS: chips + silo come from the viewer's institution.
  const institution = await getViewerInstitution();
  const areas = institution.areas;
  const parsed = safeParse(marketFilterSchema, searchParams);
  const filter = parsed.ok
    ? parsed.data
    : { q: "", category: "", area: "", minKobo: undefined, maxKobo: undefined, graduatingOnly: undefined, sort: "newest" as const, page: 1 };

  const { skip, take } = paginate(filter.page, PAGE_SIZE);

  const [total, items, drops] = await Promise.all([
    prisma.marketItem.count({ where: marketWhere(filter, institution.id) }),
    prisma.marketItem.findMany({
      where: marketWhere(filter, institution.id),
      orderBy: marketOrderBy(filter.sort),
      skip,
      take,
      include: { seller: { select: { fullName: true, isVerified: true } } },
    }),
    // The graduating strip is only shown when the user is not already filtering.
    filter.graduatingOnly
      ? Promise.resolve([])
      : prisma.marketItem.findMany({
          where: { status: "AVAILABLE", isGraduatingDrop: true },
          orderBy: { createdAt: "desc" },
          take: 4,
          include: { seller: { select: { fullName: true, isVerified: true } } },
        }),
  ]);

  /** Converts a Prisma item into the shape the card expects. */
  const toCard = (item: (typeof items)[number]) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    priceKobo: item.priceKobo,
    negotiableMinKobo: item.negotiableMinKobo,
    condition: item.condition,
    area: item.area,
    images: item.images,
    isGraduatingDrop: item.isGraduatingDrop,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    seller: item.seller,
  });

  return (
    <PageTransition>
      <PageHeader
        title="Marketplace"
        subtitle="Buy and sell with students nearby. Pay with escrow so nobody runs off with your money."
        action={
          <Link href="/market/new" className="mc-btn-primary h-10 px-3.5 text-xs">
            <PlusIcon size={16} />
            Sell
          </Link>
        }
      >
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <Link href="/market" className={`mc-chip shrink-0 ${!filter.category ? "border-primary-600 bg-primary-600 text-white" : ""}`}>
            All
          </Link>
          {MARKET_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/market?category=${encodeURIComponent(category)}`}
              className={`mc-chip shrink-0 ${filter.category === category ? "border-primary-600 bg-primary-600 text-white" : ""}`}
            >
              {category}
            </Link>
          ))}
        </div>

        {/* Area + graduating chips on a second row */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <Link
            href={`/market?graduatingOnly=true${filter.category ? `&category=${encodeURIComponent(filter.category)}` : ""}`}
            className={`mc-chip shrink-0 ${filter.graduatingOnly ? "border-gold-500 bg-gold-500 text-white" : ""}`}
          >
            <CapIcon size={12} />
            Graduating drop
          </Link>
          {areas.map((area) => (
            <Link
              key={area}
              href={`/market?area=${encodeURIComponent(area)}`}
              className={`mc-chip shrink-0 ${filter.area === area ? "border-primary-600 bg-primary-600 text-white" : ""}`}
            >
              {area}
            </Link>
          ))}
        </div>
      </PageHeader>

      {/* -------------------------------------------------------------- */}
      {/* GRADUATING STUDENT DROP STRIP                                   */}
      {/* -------------------------------------------------------------- */}
      {drops.length > 0 ? (
        <section className="mb-6 rounded-2xl bg-gold-50 p-4 ring-1 ring-gold-200">
          <div className="flex items-center gap-2">
            <CapIcon size={20} className="text-gold-700" />
            <div>
              <h2 className="text-sm font-bold text-gold-900">Graduating Student Drop</h2>
              <p className="text-[11px] text-gold-800">Final-year students clearing out - best prices of the semester</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {drops.slice(0, 2).map((item) => (
              <MarketItemCard key={item.id} item={toCard(item)} />
            ))}
          </div>

          <Link href="/market?graduatingOnly=true" className="mt-3 block text-center text-xs font-bold text-gold-800">
            See all graduating drops
          </Link>
        </section>
      ) : null}

      {/* -------------------------------------------------------------- */}
      {/* RESULTS                                                         */}
      {/* -------------------------------------------------------------- */}
      <p className="mb-3 px-1 text-xs text-slate-500">
        {total} item{total === 1 ? "" : "s"} {filter.category ? `in ${filter.category}` : ""}
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={<BagIcon size={32} />}
          title="Nothing listed yet"
          message="Be the first to sell something. Students are looking for fans, mattresses, generators and textbooks right now."
          action={
            <Link href="/market/new" className="mc-btn-primary">
              List an item
            </Link>
          }
        />
      ) : (
        <StaggerList gap={10} inView>
          {items.map((item) => (
            <MarketItemCard key={item.id} item={toCard(item)} />
          ))}
        </StaggerList>
      )}

      {/* Next page link - cheaper than infinite scroll on mobile data. */}
      {items.length === take && skip + take < total ? (
        <Link
          href={`/market?${new URLSearchParams({
            ...(filter.q ? { q: filter.q } : {}),
            ...(filter.category ? { category: filter.category } : {}),
            ...(filter.area ? { area: filter.area } : {}),
            ...(filter.graduatingOnly ? { graduatingOnly: "true" } : {}),
            page: String(filter.page + 1),
          }).toString()}`}
          className="mc-btn-secondary mt-4 w-full"
        >
          Load more
        </Link>
      ) : null}

      <FloatingBudgetButton />
    </PageTransition>
  );
}
