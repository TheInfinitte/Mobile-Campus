/**
 * src/components/market/MarketItemCard.tsx
 * WHAT: A marketplace item card - photo, price, condition, area and a
 *       "Graduating drop" badge when the seller is a final-year student.
 * WHY : Marketplace browsing is fast and visual. The card must show the price
 *       and the condition immediately, because those are the two things a
 *       student compares.
 */
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { Money } from "@/components/ui/Money";
import { CapIcon, PinIcon } from "@/components/ui/Icons";
import { timeAgo } from "@/lib/utils";

/** The item shape this card needs. */
export type MarketItemData = {
  id: string;
  title: string;
  category: string;
  priceKobo: number;
  negotiableMinKobo: number | null;
  condition: string;
  area: string;
  images: string[];
  isGraduatingDrop: boolean;
  status: string;
  createdAt: string;
  seller?: { fullName: string; isVerified: boolean };
};

/**
 * MarketItemCard
 * WHAT: One tappable card linking to the item page.
 * WHY : Horizontal layout with the photo on the left - it fits more items on a
 *       phone screen than a vertical card grid.
 */
export function MarketItemCard({ item }: { item: MarketItemData }) {
  return (
    <Link
      href={`/market/${item.id}`}
      className="flex gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-100 transition-shadow hover:shadow-lg"
    >
      {/* Photo */}
      <SmartImage
        src={item.images[0]}
        alt={item.title}
        width={300}
        rounded="xl"
        wrapperClassName="h-24 w-24 shrink-0"
      />

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{item.title}</h3>
          {item.isGraduatingDrop ? (
            <Badge tone="gold" icon={<CapIcon size={11} />} className="shrink-0">
              Grad drop
            </Badge>
          ) : null}
        </div>

        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
          <PinIcon size={11} className="shrink-0" />
          {item.area} • {timeAgo(item.createdAt)}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div>
            <Money kobo={item.priceKobo} size="md" className="text-primary-700" />
            {item.negotiableMinKobo ? (
              <p className="text-[10px] text-slate-400">Negotiable</p>
            ) : null}
          </div>
          <Badge tone="slate">{item.condition}</Badge>
        </div>
      </div>
    </Link>
  );
}
