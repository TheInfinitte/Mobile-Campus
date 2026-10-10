/**
 * src/app/landlord/listings/[id]/page.tsx
 * WHAT: The management screen for one of the landlord's own listings - edit the
 *       rent and availability, pause it, or remove it.
 * WHY : A caretaker who has just let the last room needs to hide that room in two
 *       taps, before another student books a viewing for a room that is gone.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { ListingManager } from "@/components/landlord/ListingManager";
import { Card, CardHeader } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { formatNaira } from "@/lib/money";
import { formatDateTime, walkTime } from "@/lib/utils";
import { roomTypeLabel, WATER_LABELS, METER_LABELS } from "@/lib/data";

export const metadata = { title: "Manage listing" };
export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/**
 * ManageListingPage
 * WHAT: Loads the listing with its reviews and payments, then renders the editor.
 */
export default async function ManageListingPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login?next=/landlord");

  const lodge = await prisma.lodge.findUnique({
    where: { id: params.id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      reviews: { include: { user: { select: { fullName: true, level: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
      viewingRequests: { orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { fullName: true } } } },
      _count: { select: { reviews: true, viewingRequests: true } },
    },
  });

  if (!lodge) notFound();
  if (lodge.landlordId !== user.id && user.role !== "ADMIN") redirect("/landlord");

  // Payments on this listing, so the landlord can see what has actually been paid.
  const payments = await prisma.escrowTransaction.findMany({
    where: { lodgeId: lodge.id },
    include: { payer: { select: { fullName: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <PageTransition>
      <PageHeader back backHref="/landlord" title="Manage listing" subtitle={lodge.title} />

      {/* ------------------------------------------------------------ */}
      {/* SNAPSHOT                                                       */}
      {/* ------------------------------------------------------------ */}
      <Card className="mb-4">
        <SmartImage src={lodge.images[0]?.url ?? null} alt={lodge.title} width={800} rounded="lg" wrapperClassName="h-40 w-full" />

        <div className="mt-3">
          <h2 className="text-base font-bold text-slate-900">{lodge.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {lodge.area} · {roomTypeLabel(lodge.roomType)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {lodge.isVerified ? <VerifiedBadge /> : <Badge tone="slate">Unverified</Badge>}
            <Badge tone={lodge.status === "ACTIVE" ? "success" : "gold"}>{lodge.status.toLowerCase().replace("_", " ")}</Badge>
            <Badge tone="primary">{formatNaira(lodge.monthlyRentKobo)}/month</Badge>
          </div>
        </div>

        {/* The facts a student cares about, in one glanceable row each. */}
        <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
          {[
            ["Water", WATER_LABELS[lodge.waterSource as keyof typeof WATER_LABELS] ?? lodge.waterSource],
            ["Light", METER_LABELS[lodge.meterType as keyof typeof METER_LABELS] ?? lodge.meterType],
            ["Distance", lodge.distanceToMainGateMeters ? `${lodge.distanceToMainGateMeters}m (${walkTime(lodge.distanceToMainGateMeters)})` : "Not set"],
            ["Caution deposit", formatNaira(lodge.cautionDepositKobo)],
            ["Rooms available", `${lodge.availableRooms} of ${lodge.maxOccupancy}`],
            ["Reviews", `${lodge._count.reviews}${lodge.ratingCount > 0 ? ` · ${lodge.ratingAverage.toFixed(1)} average` : ""}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-semibold text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* EDITOR                                                         */}
      {/* ------------------------------------------------------------ */}
      <ListingManager
        listing={{
          id: lodge.id,
          title: lodge.title,
          description: lodge.description,
          monthlyRentKobo: lodge.monthlyRentKobo,
          annualRentKobo: lodge.annualRentKobo,
          cautionDepositKobo: lodge.cautionDepositKobo,
          availableRooms: lodge.availableRooms,
          waterNote: lodge.waterNote,
          lightNote: lodge.lightNote,
          caretakerName: lodge.caretakerName,
          caretakerPhone: lodge.caretakerPhone,
          status: lodge.status,
        }}
      />

      {/* ------------------------------------------------------------ */}
      {/* PAYMENTS                                                       */}
      {/* ------------------------------------------------------------ */}
      <Card className="mt-4">
        <CardHeader title="Payments on this room" subtitle="Money held for you and money already released" />

        {payments.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-600">No payments yet. When a student pays, the money is held by us until they confirm they have moved in.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {payments.map((payment) => (
              <Link key={payment.id} href={`/escrow/${payment.id}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800">{payment.payer.fullName}</span>
                  <span className="block text-[10px] text-slate-500">{formatDateTime(payment.createdAt)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-slate-900">{formatNaira(payment.payoutKobo)}</span>
                  <span className="block text-[10px] text-slate-500">{payment.state.toLowerCase().replace("_", " ")}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* RECENT REVIEWS                                                 */}
      {/* ------------------------------------------------------------ */}
      {lodge.reviews.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Recent reviews" subtitle={`${lodge._count.reviews} in total`} />
          <div className="mt-3 space-y-3">
            {lodge.reviews.map((review) => (
              <div key={review.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {review.user.fullName}
                    {review.user.level ? <span className="font-medium text-slate-400"> · {review.user.level}</span> : null}
                  </span>
                  <span className="text-xs font-bold text-gold-600">{review.rating}/5</span>
                </p>
                {review.comment ? <p className="mt-1 text-xs leading-relaxed text-slate-600">{review.comment}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Link href={`/housing/${lodge.id}`} className="mc-btn-ghost mt-4 w-full">
        See how students view this listing
      </Link>
    </PageTransition>
  );
}
