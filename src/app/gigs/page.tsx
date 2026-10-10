/**
 * src/app/gigs/page.tsx
 * WHAT: The micro-gig task board - laundry, hair, food runs, tutoring and more.
 * WHY : Server-rendered list with category and area chips, so a student can find
 *       work (or help) in two taps.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { GigCard } from "@/components/gigs/GigCard";
import { FloatingBudgetButton } from "@/components/layout/FloatingBudgetButton";
import { EmptyState } from "@/components/ui/Card";
import { TaskIcon, PlusIcon } from "@/components/ui/Icons";
import { gigWhere, gigOrderBy, paginate, PAGE_SIZE } from "@/lib/search";
import { safeParse, gigFilterSchema } from "@/lib/validators";
import { GIG_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/data";
import { getViewerInstitution } from "@/lib/institution";

export const metadata = { title: "Micro-gigs" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Record<string, string | string[] | undefined> };

/**
 * GigsPage
 * WHAT: Lists open tasks with filters.
 */
export default async function GigsPage({ searchParams }: PageProps) {
  // MULTI-CAMPUS: chips + silo come from the viewer's institution.
  const institution = await getViewerInstitution();
  const areas = institution.areas;
  const parsed = safeParse(gigFilterSchema, searchParams);
  const filter = parsed.ok
    ? parsed.data
    : { gigType: undefined, q: "", category: "", area: "", minKobo: undefined, maxKobo: undefined, sort: "newest" as const, page: 1 };

  // BIDIRECTIONAL BOARD: which side are we browsing? Defaults to "wanted"
  // because that is what most students come here for (they need help).
  const boardType = filter.gigType ?? "WANTED";
  // Each side has its own category vocabulary - hiring laundry is not the
  // same list as advertising hair styling.
  const categories = boardType === "OFFERED" ? SERVICE_CATEGORIES : GIG_CATEGORIES;

  const { skip, take } = paginate(filter.page, PAGE_SIZE);

  const [total, gigs] = await Promise.all([
    prisma.gig.count({ where: gigWhere(filter, institution.id) }),
    prisma.gig.findMany({
      where: gigWhere(filter, institution.id),
      orderBy: gigOrderBy(filter.sort),
      skip,
      take,
      include: { poster: { select: { fullName: true, isVerified: true } } },
    }),
  ]);

  return (
    <PageTransition>
      <PageHeader
        title="Micro-gigs"
        subtitle={boardType === "OFFERED" ? "Students advertising their own services. Hire one, pay through escrow." : "Small jobs, paid through escrow. Do a task, get paid the same day."}
        action={
          <Link href={`/gigs/new?gigType=${boardType}`} className="mc-btn-primary h-10 px-3.5 text-xs">
            <PlusIcon size={16} />
            Post
          </Link>
        }
      >
        {/* BIDIRECTIONAL TOGGLE - the two sides of the board. */}
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Gig board mode">
          {([
            { type: "WANTED", label: "Services Wanted", hint: "Students hiring help" },
            { type: "OFFERED", label: "Services Offered", hint: "Students selling skills" },
          ] as const).map((mode) => (
            <Link
              key={mode.type}
              href={`/gigs?gigType=${mode.type}`}
              role="tab"
              aria-selected={boardType === mode.type}
              className={`min-h-11 rounded-lg px-2 py-2 text-center transition-colors ${
                boardType === mode.type ? "bg-white font-bold text-primary-700 shadow-sm" : "text-slate-500"
              }`}
            >
              <span className="block text-xs">{mode.label}</span>
              <span className="block text-[10px] font-normal opacity-70">{mode.hint}</span>
            </Link>
          ))}
        </div>

        {/* Category chips - vocabulary follows the active side. */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <Link
            href={`/gigs?gigType=${boardType}`}
            className={`mc-chip shrink-0 ${!filter.category ? "border-primary-600 bg-primary-600 text-white" : ""}`}
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={`/gigs?gigType=${boardType}&category=${encodeURIComponent(category)}`}
              className={`mc-chip shrink-0 ${filter.category === category ? "border-primary-600 bg-primary-600 text-white" : ""}`}
            >
              {category}
            </Link>
          ))}
        </div>

        {/* Area chips */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {areas.map((area) => (
            <Link
              key={area}
              href={`/gigs?gigType=${boardType}&area=${encodeURIComponent(area)}`}
              className={`mc-chip shrink-0 ${filter.area === area ? "border-primary-600 bg-primary-600 text-white" : ""}`}
            >
              {area}
            </Link>
          ))}
        </div>
      </PageHeader>

      <p className="mb-3 px-1 text-xs text-slate-500">
        {total} open task{total === 1 ? "" : "s"}
      </p>

      {gigs.length === 0 ? (
        <EmptyState
          icon={<TaskIcon size={32} />}
          title={boardType === "OFFERED" ? "No services offered yet" : "No open tasks right now"}
          message={
            boardType === "OFFERED"
              ? "Be the first to advertise your skill - hair, laundry, tech support - and let classmates hire you."
              : "Post what you need done - laundry, tutoring, cleaning - and a student nearby will pick it up."
          }
          action={
            <Link href={`/gigs/new?gigType=${boardType}`} className="mc-btn-primary">
              {boardType === "OFFERED" ? "Offer my service" : "Post a task"}
            </Link>
          }
        />
      ) : (
        <StaggerList gap={10} inView>
          {gigs.map((gig) => (
            <GigCard
              key={gig.id}
              gig={{
                id: gig.id,
                gigType: gig.gigType,
                isSponsored: gig.isSponsored,
                title: gig.title,
                description: gig.description,
                category: gig.category,
                area: gig.area,
                budgetKobo: gig.budgetKobo,
                isNegotiable: gig.isNegotiable,
                dueDate: gig.dueDate ? gig.dueDate.toISOString() : null,
                status: gig.status,
                createdAt: gig.createdAt.toISOString(),
                poster: gig.poster,
              }}
            />
          ))}
        </StaggerList>
      )}

      <FloatingBudgetButton />
    </PageTransition>
  );
}
