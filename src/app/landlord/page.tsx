/**
 * src/app/landlord/page.tsx
 * WHAT: The landlord and caretaker dashboard - their listings, the viewing
 *       requests waiting on them, and their verification status.
 * WHY : A caretaker in Ajalomi is managing rooms on a phone, often in bad light,
 *       with one hand. Everything they need is one tap deep from here.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { StaggerList } from "@/components/motion/StaggerList";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { HomeIcon, PlusIcon, ShieldIcon, ClockIcon, EyeIcon, ChevronRightIcon, MoneyIcon, PhoneIcon } from "@/components/ui/Icons";
import { formatNaira } from "@/lib/money";
import { formatDateTime, timeAgo, telLink } from "@/lib/utils";

export const metadata = { title: "Landlord dashboard" };
export const dynamic = "force-dynamic";

/**
 * LandlordPage
 * WHAT: Loads the landlord's lodges, their pending viewings and their earnings.
 */
export default async function LandlordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/landlord");
  if (user.role !== "LANDLORD" && user.role !== "ADMIN") redirect("/profile");

  const [lodges, viewings, payouts] = await Promise.all([
    prisma.lodge.findMany({
      where: { landlordId: user.id },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.viewingRequest.findMany({
      where: { lodge: { landlordId: user.id }, status: { in: ["REQUESTED", "CONFIRMED"] } },
      include: {
        user: { select: { id: true, fullName: true, phone: true, isVerified: true, level: true } },
        lodge: { select: { id: true, title: true, area: true } },
      },
      orderBy: { preferredDate: "asc" },
      take: 30,
    }),
    prisma.escrowTransaction.findMany({
      where: { payeeId: user.id, state: { in: ["HELD", "CONFIRMED", "RELEASED"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Money already collected, and money waiting for the tenant to confirm.
  const collectedKobo = payouts.filter((tx) => tx.state === "RELEASED").reduce((sum, tx) => sum + tx.payoutKobo, 0);
  const waitingKobo = payouts.filter((tx) => tx.state !== "RELEASED").reduce((sum, tx) => sum + tx.payoutKobo, 0);

  const requested = viewings.filter((viewing) => viewing.status === "REQUESTED");

  return (
    <PageTransition>
      <PageHeader
        title="My properties"
        subtitle={`${lodges.length} ${lodges.length === 1 ? "listing" : "listings"} · ${requested.length} new viewing ${requested.length === 1 ? "request" : "requests"}`}
        action={
          <Link href="/housing/new" className="mc-btn-primary h-10 px-3.5 text-xs">
            <PlusIcon size={16} />
            Add room
          </Link>
        }
      />

      {/* ------------------------------------------------------------ */}
      {/* AGENT MODE BANNER                                              */}
      {/* ------------------------------------------------------------ */}
      {user.landlordType === "AGENT" ? (
        <Card className="mb-4 border border-gold-300 bg-gold-50">
          <p className="text-sm font-bold text-gold-800">Agent / representative account</p>
          <p className="mt-1 text-xs leading-relaxed text-gold-800/90">
            You list on behalf of {user.principalName ?? "the property owner"}. Every listing transparently shows a
            "Managed on behalf of the owner" badge so students always know who they are dealing with.
          </p>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* VERIFICATION BANNER                                            */}
      {/* ------------------------------------------------------------ */}
      {!user.isVerified ? (
        <Card className="mb-4 border border-warn/30 bg-warn-light">
          <div className="flex items-start gap-2.5">
            <ShieldIcon size={18} className="mt-0.5 shrink-0 text-warn-dark" />
            <div>
              <p className="text-sm font-bold text-warn-dark">You are not verified yet</p>
              <p className="mt-1 text-xs leading-relaxed text-warn-dark/90">
                Students filter by the Verified badge, so unverified listings get far fewer enquiries. Upload a property photo and
                your ownership document and we will usually approve within a few hours.
              </p>
              <Link href="/profile/verification" className="mc-btn-primary mt-3 bg-warn-dark text-white hover:opacity-90">
                Get verified
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* EARNINGS                                                       */}
      {/* ------------------------------------------------------------ */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="bg-primary-900 text-white">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary-200">Collected</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatNaira(collectedKobo)}</p>
          <p className="mt-0.5 text-[10px] text-primary-200">Released to your bank</p>
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Waiting on tenants</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{formatNaira(waitingKobo)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Held in escrow</p>
        </Card>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* VIEWING REQUESTS                                               */}
      {/* ------------------------------------------------------------ */}
      <section className="mb-6">
        <CardHeader
          title="Viewing requests"
          subtitle={requested.length > 0 ? "Reply quickly - students book the first caretaker who answers" : "Nothing waiting on you"}
          className="mb-3 px-1"
        />

        {viewings.length === 0 ? (
          <Card className="bg-slate-50">
            <p className="text-xs leading-relaxed text-slate-600">
              When a student asks to come and see one of your rooms, it will appear here with their name, their level and the time
              they want to come.
            </p>
          </Card>
        ) : (
          <StaggerList gap={10} inView>
            {viewings.map((viewing) => (
              <Card key={viewing.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{viewing.user.fullName}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {viewing.lodge.title} · {viewing.lodge.area}
                    </p>
                    {viewing.user.level ? <p className="mt-0.5 text-[11px] text-slate-500">{viewing.user.level}</p> : null}
                  </div>

                  <Badge tone={viewing.status === "CONFIRMED" ? "success" : "gold"}>{viewing.status.toLowerCase()}</Badge>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <ClockIcon size={14} className="text-slate-400" />
                  {formatDateTime(viewing.preferredDate)}
                </div>

                {viewing.message ? (
                  <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600">&ldquo;{viewing.message}&rdquo;</p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <a href={telLink(viewing.user.phone)} className="mc-btn-secondary flex-1">
                    <PhoneIcon size={15} />
                    Call
                  </a>
                  <Link href={`/landlord/viewings/${viewing.id}`} className="mc-btn-primary flex-1">
                    Respond
                  </Link>
                </div>

                <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                  {viewing.user.isVerified ? <VerifiedBadge label="Verified student" /> : <Badge tone="slate">Provisional account</Badge>}
                  <span>· requested {timeAgo(viewing.createdAt)}</span>
                </p>
              </Card>
            ))}
          </StaggerList>
        )}
      </section>

      {/* ------------------------------------------------------------ */}
      {/* MY LISTINGS                                                    */}
      {/* ------------------------------------------------------------ */}
      <section>
        <CardHeader title="My listings" className="mb-3 px-1" />

        {lodges.length === 0 ? (
          <EmptyState
            icon={<HomeIcon size={32} />}
            title="No rooms listed yet"
            message="Add your first room with photos, the rent, the water situation and how far it is from the gate. It takes about five minutes."
            action={
              <Link href="/housing/new" className="mc-btn-primary">
                <PlusIcon size={16} />
                Add a room
              </Link>
            }
          />
        ) : (
          <StaggerList gap={12} inView>
            {lodges.map((lodge) => (
              <Link key={lodge.id} href={`/landlord/listings/${lodge.id}`} className="block">
                <Card padded={false} className="overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <SmartImage src={lodge.images[0]?.url ?? null} alt={lodge.title} width={200} rounded="lg" wrapperClassName="h-20 w-20 shrink-0" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{lodge.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {lodge.area} · {formatNaira(lodge.monthlyRentKobo)}/month
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {lodge.isVerified ? <VerifiedBadge /> : <Badge tone="slate">Unverified</Badge>}
                        <Badge tone={lodge.status === "ACTIVE" ? "success" : "gold"}>{lodge.status.toLowerCase().replace("_", " ")}</Badge>
                        <span className="text-[11px] text-slate-400">{lodge.availableRooms} available</span>
                      </div>
                    </div>

                    <ChevronRightIcon size={16} className="mt-1 shrink-0 text-slate-300" />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <EyeIcon size={13} />
                      {lodge.ratingCount} review{lodge.ratingCount === 1 ? "" : "s"}
                      {lodge.ratingCount > 0 ? ` · ${lodge.ratingAverage.toFixed(1)} stars` : ""}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-primary-700">
                      <MoneyIcon size={13} />
                      Manage
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </StaggerList>
        )}
      </section>

      {lodges.length > 0 ? (
        <Link href="/housing/new" className="mc-btn-secondary mt-4 w-full">
          <PlusIcon size={16} />
          Add another room
        </Link>
      ) : null}
    </PageTransition>
  );
}
