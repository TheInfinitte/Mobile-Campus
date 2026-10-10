/**
 * src/app/market/[id]/page.tsx
 * WHAT: One marketplace item: photos, price, condition, pickup details, the
 *       seller, and the escrow payment action.
 * WHY : A buyer needs to see the seller's verification status and the exact total
 *       (price + fee) before they pay.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser, canPayAndMessage, upgradeMessage } from "@/lib/auth";
import { escrowFeeBreakdown } from "@/lib/fees";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, VerifiedBadge, StatusBadge } from "@/components/ui/Badge";
import { Avatar, SmartImage } from "@/components/ui/SmartImage";
import { Money } from "@/components/ui/Money";
import { EscrowActions } from "@/components/shared/EscrowActions";
import { CapIcon, EyeIcon, PinIcon } from "@/components/ui/Icons";
import { whatsappLink } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/** Page metadata built from the item, so shared links preview properly. */
export async function generateMetadata({ params }: PageProps) {
  const item = await prisma.marketItem.findUnique({ where: { id: params.id }, select: { title: true, priceKobo: true, area: true } });
  if (!item) return { title: "Item not found" };
  return {
    title: item.title,
    description: `${item.title} for ₦${(item.priceKobo / 100).toLocaleString("en-NG")} in ${item.area} on Mobile Campus.`,
  };
}

/**
 * MarketItemPage
 * WHAT: Loads the item and renders it with the escrow actions.
 */
export default async function MarketItemPage({ params }: PageProps) {
  const [item, user] = await Promise.all([
    prisma.marketItem.findUnique({
      where: { id: params.id },
      include: { seller: { select: { id: true, fullName: true, phone: true, isVerified: true, avatarUrl: true, level: true, createdAt: true } } },
    }),
    getSessionUser(),
  ]);

  if (!item || item.status === "REMOVED") notFound();

  // Count the view without blocking the page.
  void prisma.marketItem.update({ where: { id: item.id }, data: { views: { increment: 1 } } }).catch(() => null);

  const fees = await escrowFeeBreakdown(item.priceKobo);

  const shortlisted = user
    ? Boolean(await prisma.shortlist.findFirst({ where: { userId: user.id, marketItemId: item.id } }))
    : false;

  // The seller cannot buy their own item.
  const isMine = user?.id === item.sellerId;

  return (
    <PageTransition>
      <PageHeader back backHref="/market" title={item.category} subtitle="Student marketplace" />

      {/* Photo */}
      <SmartImage
        src={item.images[0]}
        alt={item.title}
        width={1000}
        rounded="xl"
        wrapperClassName="-mx-4 h-64 w-[calc(100%+2rem)] sm:mx-0 sm:w-full sm:h-80"
      />

      {/* Extra photos */}
      {item.images.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {item.images.slice(1).map((url, index) => (
            <SmartImage key={url} src={url} alt={`Photo ${index + 2}`} width={200} rounded="lg" wrapperClassName="h-16 w-20 shrink-0" />
          ))}
        </div>
      ) : null}

      {/* Price and status */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {item.isGraduatingDrop ? (
            <Badge tone="gold" icon={<CapIcon size={11} />}>
              Graduating student drop
            </Badge>
          ) : null}
          <StatusBadge status={item.status} />
          <Badge tone="slate">{item.condition}</Badge>
        </div>

        <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight text-slate-900">{item.title}</h1>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <Money kobo={item.priceKobo} size="xl" className="text-primary-700" />
          {item.negotiableMinKobo ? (
            <span className="text-xs text-slate-500">
              Lowest the seller accepts: <Money kobo={item.negotiableMinKobo} size="xs" className="font-bold" />
            </span>
          ) : null}
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <PinIcon size={13} />
            {item.area}
          </span>
          <span className="inline-flex items-center gap-1">
            <EyeIcon size={13} />
            {item.views} view{item.views === 1 ? "" : "s"}
          </span>
          <span>Listed {timeAgo(item.createdAt)}</span>
        </p>
      </div>

      {/* Description */}
      <Card className="mt-4">
        <CardHeader title="Description" />
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.description}</p>
        {item.pickupNote ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <strong className="font-semibold text-slate-800">Pickup:</strong> {item.pickupNote}
          </p>
        ) : null}
      </Card>

      {/* Seller */}
      <Card className="mt-4">
        <CardHeader title="Seller" subtitle={item.seller.isVerified ? "Verified student" : "Not verified yet"} />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={item.seller.avatarUrl} name={item.seller.fullName} size={42} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{item.seller.fullName}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{item.seller.level ?? "Student"} • Joined {timeAgo(item.seller.createdAt)}</p>
            </div>
          </div>

          {item.seller.isVerified ? <VerifiedBadge /> : null}
        </div>

        {item.seller.phone ? (
          <a
            href={whatsappLink(item.seller.phone, `Hello, I saw "${item.title}" on Mobile Campus. Is it still available?`)}
            target="_blank"
            rel="noreferrer noopener"
            className="mc-btn-secondary mt-3 w-full"
          >
            Chat on WhatsApp
          </a>
        ) : null}
      </Card>

      {/* Actions - or a note if this is the viewer's own item. */}
      <div className="mt-4">
        {isMine ? (
          <Card>
            <p className="text-sm text-slate-600">This is your listing. You cannot buy your own item.</p>
          </Card>
        ) : (
          <EscrowActions
            type="PURCHASE"
            targetId={item.id}
            title={item.title}
            amountKobo={item.priceKobo}
            feeLines={fees.lines}
            totalKobo={item.priceKobo + fees.payerFeeKobo}
            payoutKobo={item.priceKobo - fees.payeeFeeKobo}
            canPay={user ? canPayAndMessage(user) && item.status === "AVAILABLE" : false}
            signedIn={Boolean(user)}
            upgradeNote={upgradeMessage()}
            shortlisted={shortlisted}
            reportedUserId={item.sellerId}
          />
        )}
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
        Meet in a public place on campus when collecting. Never send money outside Mobile Campus - only escrow payments are
        protected.
      </p>

      <Link href="/market" className="mc-btn-secondary mt-4 w-full">
        Back to marketplace
      </Link>
    </PageTransition>
  );
}
