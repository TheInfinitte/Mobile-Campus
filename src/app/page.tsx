/**
 * src/app/page.tsx
 * WHAT: The home page - a welcome hero, the three big features, the newest
 *       verified lodges and the Graduating Student Drop.
 * WHY : Most students arrive from a shared link. In five seconds they must
 *       understand what this is and tap into the part they need. The page is a
 *       server component, so the data arrives already rendered (no spinner on a
 *       slow connection).
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageTransition } from "@/components/motion/PageTransition";
import { FadeIn, StaggerList } from "@/components/motion/StaggerList";
import { LodgeCard } from "@/components/housing/LodgeCard";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BagIcon, CapIcon, PeopleIcon, ShieldIcon, SparkleIcon, TaskIcon } from "@/components/ui/Icons";
import { getInstitutionAreas } from "@/lib/institution";

/** This page is always fresh - prices and availability change constantly. */
export const dynamic = "force-dynamic";

/** Page metadata for the browser tab. */
export const metadata = { title: "Verified student housing, market and gigs" };

/**
 * HomePage
 * WHAT: Loads a small amount of real data and renders the landing experience.
 * WHY : We fetch only what is visible above and just below the fold, so the page
 *       is light on mobile data.
 */
export default async function HomePage() {
  // MULTI-CAMPUS: show the viewer's own communities on the home screen.
  const areas = await getInstitutionAreas();
  const user = await getSessionUser();

  // Three parallel queries: the best lodges, the newest items and the newest
  // graduating-student drops.
  const [lodges, items, drops] = await Promise.all([
    prisma.lodge.findMany({
      where: { status: "ACTIVE", isVerified: true },
      orderBy: [{ ratingAverage: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: { images: { where: { isCover: true }, take: 1 } },
    }),
    prisma.marketItem.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { seller: { select: { fullName: true, isVerified: true } } },
    }),
    prisma.marketItem.findMany({
      where: { status: "AVAILABLE", isGraduatingDrop: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { seller: { select: { fullName: true, isVerified: true } } },
    }),
  ]);

  return (
    <PageTransition>
      {/* ---------------------------------------------------------------- */}
      {/* HERO                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl bg-primary-900 px-5 py-8 text-white sm:px-8 sm:py-10">
        {/* Decorative gradient - no image download needed. */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-primary-500/30 blur-3xl" aria-hidden="true" />

        <div className="relative">
          <Badge tone="gold" className="mb-3">
            <CapIcon size={12} />
            Delta State University, Abraka
          </Badge>

          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            {user ? `Welcome back, ${user.fullName.split(" ")[0]}` : "Find a place you can actually trust."}
          </h1>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-primary-100">
            Verified off-campus lodges, a student marketplace, micro-gigs and an AI that tells you exactly what your money
            can cover - all protected by escrow.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/housing" className="mc-btn-primary bg-gold-500 text-white hover:bg-gold-600">
              Browse lodges
            </Link>
            <Link href="/budget" className="mc-btn-secondary bg-white/10 text-white hover:bg-white/20">
              <SparkleIcon size={16} />
              Ask Budget AI
            </Link>
          </div>

          {/* Trust line - the single most important promise on the site. */}
          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-primary-200">
            <ShieldIcon size={13} />
            Your money is held in escrow and only released after you confirm.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* QUICK AREA CHIPS                                                  */}
      {/* ---------------------------------------------------------------- */}
      <FadeIn delay={0.05}>
        <div className="mt-6">
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">Popular areas</p>
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {areas.map((area) => (
              <Link key={area} href={`/housing?area=${encodeURIComponent(area)}`} className="mc-chip shrink-0">
                {area}
              </Link>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ---------------------------------------------------------------- */}
      {/* THE THREE FEATURES                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-7">
        <h2 className="mb-3 px-1 text-lg font-bold tracking-tight text-slate-900">What you can do here</h2>

        <StaggerList gap={12}>
          {[
            {
              href: "/housing",
              Icon: ShieldIcon,
              title: "Verified housing",
              body: "Lodges in Ekrejeta, Ajalomi, Uruoka and Oria with water, light and distance details - and a caretaker you can call.",
              tone: "bg-primary-50 text-primary-700",
            },
            {
              href: "/roommates",
              Icon: PeopleIcon,
              title: "Roommate matching",
              body: "Answer six quick questions and see who you would actually live well with, then rent together and split the payment.",
              tone: "bg-gold-50 text-gold-700",
            },
            {
              href: "/market",
              Icon: BagIcon,
              title: "Student marketplace",
              body: "Generators, mattresses, fans, gas cylinders and books from students nearby - plus a Graduating Student Drop.",
              tone: "bg-success-light text-success-dark",
            },
            {
              href: "/gigs",
              Icon: TaskIcon,
              title: "Micro-gigs",
              body: "Laundry, hair, food runs and tutoring. Pay through escrow so the worker knows the money is there.",
              tone: "bg-slate-100 text-slate-700",
            },
          ].map(({ href, Icon, title, body, tone }) => (
            <Link key={href} href={href} className="flex gap-3.5 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{body}</span>
              </span>
            </Link>
          ))}
        </StaggerList>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FEATURED LODGES                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Top rated lodges</h2>
            <p className="text-xs text-slate-500">Verified landlords only</p>
          </div>
          <Link href="/housing" className="shrink-0 text-xs font-bold text-primary-700">
            See all
          </Link>
        </div>

        {lodges.length > 0 ? (
          <StaggerList gap={12} inView>
            {lodges.map((lodge) => (
              <LodgeCard
                key={lodge.id}
                lodge={{
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
                }}
              />
            ))}
          </StaggerList>
        ) : (
          <Card>
            <p className="text-sm text-slate-600">
              No lodges yet. Run <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npm run db:seed</code> to load
              the sample DELSU data.
            </p>
          </Card>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* GRADUATING STUDENT DROP                                           */}
      {/* ---------------------------------------------------------------- */}
      {drops.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
                <CapIcon size={20} className="text-gold-600" />
                Graduating Student Drop
              </h2>
              <p className="text-xs text-slate-500">Final-year students selling fast</p>
            </div>
            <Link href="/market?graduatingOnly=true" className="shrink-0 text-xs font-bold text-primary-700">
              See all
            </Link>
          </div>

          <StaggerList gap={10} inView>
            {drops.map((item) => (
              <MarketItemCard
                key={item.id}
                item={{
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
                }}
              />
            ))}
          </StaggerList>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* NEW ON THE MARKET                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Just listed</h2>
          <Link href="/market" className="shrink-0 text-xs font-bold text-primary-700">
            See all
          </Link>
        </div>

        <StaggerList gap={10} inView>
          {items.map((item) => (
            <MarketItemCard
              key={item.id}
              item={{
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
              }}
            />
          ))}
        </StaggerList>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* NOT SIGNED IN YET?                                                */}
      {/* ---------------------------------------------------------------- */}
      {!user ? (
        <Card className="mt-8 bg-primary-900 text-white">
          <h2 className="text-lg font-bold">Create your free account</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-primary-100">
            Verify with your matric number (or your JAMB admission letter if you are a fresher) to unlock escrow payments and
            messaging.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/auth/signup" className="mc-btn-primary flex-1 bg-gold-500 hover:bg-gold-600">
              Sign up
            </Link>
            <Link href="/auth/login" className="mc-btn-secondary flex-1 bg-white/10 text-white hover:bg-white/20">
              Sign in
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Footer note about data protection. */}
      <p className="mt-8 px-1 text-center text-[11px] leading-relaxed text-slate-400">
        Mobile Campus processes your data under the Nigeria Data Protection Act (NDPA). Matric and JAMB numbers are encrypted
        and never shown publicly.
      </p>
    </PageTransition>
  );
}
