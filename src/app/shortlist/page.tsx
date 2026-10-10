/**
 * src/app/shortlist/page.tsx
 * WHAT: Everything a user has saved - lodges, market items and gigs.
 * WHY : Provisional students (freshers with a JAMB number) cannot pay or message
 *       yet, but they CAN shortlist. This screen is their main tool, so it is
 *       designed to work well for them.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canPayAndMessage } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { Card, EmptyState } from "@/components/ui/Card";
import { LodgeCard } from "@/components/housing/LodgeCard";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { GigCard } from "@/components/gigs/GigCard";
import { HeartIcon, LockIcon } from "@/components/ui/Icons";
import { formatNaira } from "@/lib/money";
import { areaLabel } from "@/lib/data";

export const metadata = { title: "My shortlist" };
export const dynamic = "force-dynamic";

/**
 * ShortlistPage
 * WHAT: Reads the three kinds of shortlisted item and groups them on one screen.
 * WHY : One screen beats three tabs - a student comparing a room against a
 *       generator purchase wants to see both.
 */
export default async function ShortlistPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/shortlist");

  const items = await prisma.shortlist.findMany({
    where: { userId: user.id },
    include: {
      lodge: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      marketItem: { include: { seller: { select: { fullName: true, isVerified: true } } } },
      gig: { include: { poster: { select: { fullName: true, isVerified: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const lodges = items.filter((item) => item.lodge).map((item) => item.lodge!);
  const market = items.filter((item) => item.marketItem).map((item) => item.marketItem!);
  const gigs = items.filter((item) => item.gig).map((item) => item.gig!);

  // Total of everything saved, which is a useful number when planning a move.
  const savedTotal =
    lodges.reduce((sum, lodge) => sum + lodge.monthlyRentKobo, 0) + market.reduce((sum, item) => sum + item.priceKobo, 0);

  const canAct = canPayAndMessage(user);

  return (
    <PageTransition>
      <PageHeader
        title="Shortlist"
        subtitle={items.length === 0 ? "Nothing saved yet" : `${items.length} saved ${items.length === 1 ? "item" : "items"}`}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<HeartIcon size={32} />}
          title="Your shortlist is empty"
          message="Tap the heart on any room, item or task to save it here. Shortlisting is free and open to everyone, including freshers still waiting for full verification."
          action={
            <Link href="/housing" className="mc-btn-primary">
              Start browsing rooms
            </Link>
          }
        />
      ) : (
        <>
          {/* ------------------------------------------------------------ */}
          {/* PROVISIONAL ACCOUNT BANNER                                    */}
          {/* ------------------------------------------------------------ */}
          {!canAct ? (
            <Card className="mb-4 border border-warn/30 bg-warn-light">
              <div className="flex items-start gap-2.5">
                <LockIcon size={18} className="mt-0.5 shrink-0 text-warn-dark" />
                <div>
                  <p className="text-sm font-bold text-warn-dark">You can shortlist, but not contact or pay yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-warn-dark/90">
                    Your fresher account lets you save and compare. Once you submit your student ID after registration,
                    messaging and payments unlock.
                  </p>
                  <Link href="/profile/verification" className="mc-btn-primary mt-3 bg-warn-dark text-white hover:opacity-90">
                    Complete verification
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          {/* A quick total of what the shortlist would cost. */}
          {savedTotal > 0 ? (
            <Card className="mb-4 bg-slate-900 text-white">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">If you took everything here</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{formatNaira(savedTotal)}</p>
              <p className="mt-1 text-[11px] text-slate-400">Rooms are shown per month. Fees and caution deposits are extra.</p>
            </Card>
          ) : null}

          {lodges.length > 0 ? (
            <section className="mb-6">
              <h2 className="mb-1 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Rooms ({lodges.length})</h2>
              <p className="mb-3 px-1 text-[11px] text-slate-500">
                {lodges.map((lodge) => areaLabel(lodge.area)).filter((value, index, list) => list.indexOf(value) === index).join(" · ")}
              </p>
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
            </section>
          ) : null}

          {market.length > 0 ? (
            <section className="mb-6">
              <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Market ({market.length})</h2>
              <StaggerList gap={12} inView>
                {market.map((item) => (
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
                      seller: item.seller
                        ? { fullName: item.seller.fullName, isVerified: item.seller.isVerified }
                        : undefined,
                    }}
                  />
                ))}
              </StaggerList>
            </section>
          ) : null}

          {gigs.length > 0 ? (
            <section>
              <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-slate-400">Tasks ({gigs.length})</h2>
              <StaggerList gap={12} inView>
                {gigs.map((gig) => (
                  <GigCard
                    key={gig.id}
                    gig={{
                      id: gig.id,
                      title: gig.title,
                      description: gig.description,
                      category: gig.category,
                      area: gig.area,
                      budgetKobo: gig.budgetKobo,
                      isNegotiable: gig.isNegotiable,
                      dueDate: gig.dueDate ? gig.dueDate.toISOString() : null,
                      status: gig.status,
                      createdAt: gig.createdAt.toISOString(),
                      poster: gig.poster
                        ? { fullName: gig.poster.fullName, isVerified: gig.poster.isVerified }
                        : undefined,
                    }}
                  />
                ))}
              </StaggerList>
            </section>
          ) : null}
        </>
      )}
    </PageTransition>
  );
}
