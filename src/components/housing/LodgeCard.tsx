/**
 * src/components/housing/LodgeCard.tsx
 * WHAT: The lodge listing card - photo, title, area, badges (verified, borehole,
 *       meter), distance, rating and price.
 * WHY : This is the most-seen component in the app. It has to answer three
 *       questions in under two seconds: how much, where, and can I trust it?
 */
import Link from "next/link";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { Money } from "@/components/ui/Money";
import { BoltIcon, DropIcon, PinIcon, StarIcon } from "@/components/ui/Icons";
import { formatNairaCompact } from "@/lib/money";
import { roomTypeLabel, METER_LABELS, WATER_LABELS } from "@/lib/data";
import { walkTime } from "@/lib/utils";

/** The shape of a lodge passed to this card. */
export type LodgeCardData = {
  id: string;
  title: string;
  area: string;
  roomType: string;
  monthlyRentKobo: number;
  annualRentKobo: number;
  waterSource: string;
  meterType: string;
  distanceToMainGateMeters: number | null;
  ratingAverage: number;
  ratingCount: number;
  isVerified: boolean;
  coverImage: string | null;
  availableRooms?: number;
  // Transparency: listed by an agent on behalf of the real owner.
  managedByAgent?: boolean;
  principalName?: string | null;
};

/**
 * LodgeCard
 * WHAT: One clickable card linking to the lodge detail page.
 * WHY : The whole card is a link, so a student can tap anywhere - a much bigger
 *       target than a small "View" button.
 */
export function LodgeCard({ lodge }: { lodge: LodgeCardData }) {
  return (
    <Link
      href={`/housing/${lodge.id}`}
      className="group block overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100 transition-shadow hover:shadow-lg"
    >
      {/* Photo with badges overlaid. */}
      <div className="relative">
        <SmartImage
          src={lodge.coverImage}
          alt={lodge.title}
          width={800}
          rounded="none"
          wrapperClassName="h-44 w-full"
        />

        {/* Top-left: verification badge - the trust signal. */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {lodge.isVerified ? <VerifiedBadge /> : <Badge tone="slate">Unverified</Badge>}
          {lodge.managedByAgent ? <Badge tone="gold">Managed for owner</Badge> : null}
        </div>

        {/* Top-right: rating, only when there is at least one review. */}
        {lodge.ratingCount > 0 ? (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-slate-900 shadow-sm">
            <StarIcon size={12} filled className="text-gold-500" />
            {lodge.ratingAverage.toFixed(1)}
            <span className="font-medium text-slate-500">({lodge.ratingCount})</span>
          </div>
        ) : null}

        {/* Bottom-left: price, on a dark pill so it is readable over any photo. */}
        <div className="absolute bottom-3 left-3 rounded-xl bg-slate-900/85 px-2.5 py-1.5 backdrop-blur-sm">
          <span className="text-sm font-extrabold text-white">{formatNairaCompact(lodge.monthlyRentKobo)}</span>
          <span className="ml-0.5 text-[10px] font-medium text-slate-300">/month</span>
        </div>
      </div>

      {/* Text content */}
      <div className="p-4">
        <h3 className="line-clamp-1 text-sm font-bold text-slate-900">{lodge.title}</h3>

        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <PinIcon size={13} className="shrink-0" />
          <span className="truncate">
            {lodge.area} • {walkTime(lodge.distanceToMainGateMeters)}
          </span>
        </p>

        {/* Utility chips: these decide whether a student taps in. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="primary" icon={<DropIcon size={12} />}>
            {WATER_LABELS[lodge.waterSource] ?? lodge.waterSource}
          </Badge>
          <Badge tone="outline" icon={<BoltIcon size={12} />}>
            {METER_LABELS[lodge.meterType] ?? lodge.meterType}
          </Badge>
          <Badge tone="slate">{roomTypeLabel(lodge.roomType)}</Badge>
        </div>

        {/* Footer: annual price and availability. */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[11px] text-slate-500">
            <Money kobo={lodge.annualRentKobo} size="xs" className="font-bold text-slate-700" /> / year
          </span>
          {typeof lodge.availableRooms === "number" && lodge.availableRooms > 0 ? (
            <span className="text-[11px] font-semibold text-success-dark">
              {lodge.availableRooms} room{lodge.availableRooms === 1 ? "" : "s"} left
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400">Fully booked</span>
          )}
        </div>
      </div>
    </Link>
  );
}
