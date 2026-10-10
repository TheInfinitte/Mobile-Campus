/**
 * src/components/gigs/GigCard.tsx
 * WHAT: A micro-gig task card: what needs doing, how much it pays, where, and
 *       when it is due.
 * WHY : Gigs are time-sensitive and money-focused, so the pay amount is the
 *       largest thing on the card and the due date is always visible.
 */
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { ClockIcon, PinIcon } from "@/components/ui/Icons";
import { formatDate, timeAgo, truncate } from "@/lib/utils";

/** The gig shape this card needs. */
export type GigData = {
  id: string;
  // Which side of the board: WANTED = hiring help, OFFERED = selling a skill.
  gigType?: "WANTED" | "OFFERED";
  // Sponsored posts get a small "Promoted" tag for transparency.
  isSponsored?: boolean;
  title: string;
  description: string;
  category: string;
  area: string;
  budgetKobo: number;
  isNegotiable: boolean;
  dueDate: string | null;
  status: string;
  createdAt: string;
  poster?: { fullName: string; isVerified: boolean };
};

/**
 * GigCard
 * WHAT: One tappable card linking to the gig page.
 * WHY : The left-hand pay pill makes scanning a list of tasks very fast.
 */
export function GigCard({ gig }: { gig: GigData }) {
  // Show "Due tomorrow" style urgency for tasks that are close.
  const dueSoon = gig.dueDate ? new Date(gig.dueDate).getTime() - Date.now() < 48 * 60 * 60 * 1000 : false;
  // OFFERED posts advertise a price the provider CHARGES; WANTED posts state
  // what the poster PAYS. Same money pill, honest wording.
  const isOffered = gig.gigType === "OFFERED";

  return (
    <Link
      href={`/gigs/${gig.id}`}
      className="flex gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100 transition-shadow hover:shadow-lg"
    >
      {/* The money pill - "pays" when hiring, "charges" when offering. */}
      <div className={`flex w-20 shrink-0 flex-col items-center justify-center rounded-xl py-2 ${isOffered ? "bg-gold-50" : "bg-primary-50"}`}>
        <Money kobo={gig.budgetKobo} size="sm" className={isOffered ? "text-gold-800" : "text-primary-700"} />
        <span className={`text-[9px] font-semibold uppercase tracking-wide ${isOffered ? "text-gold-700" : "text-primary-500"}`}>
          {isOffered ? "charges" : "pays"}
        </span>
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{gig.title}</h3>
          <span className="flex shrink-0 items-center gap-1">
            {gig.isSponsored ? <Badge tone="gold">Promoted</Badge> : null}
            <Badge tone="outline">{gig.category}</Badge>
          </span>
        </div>
        {/* Which side of the board this post is on. */}
        <Badge tone={isOffered ? "gold" : "primary"} className="mt-1.5">
          {isOffered ? "Service offered" : "Help wanted"}
        </Badge>

        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{truncate(gig.description, 110)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <PinIcon size={11} className="shrink-0" />
            {gig.area}
          </span>
          {gig.dueDate ? (
            <span className={`inline-flex items-center gap-1 ${dueSoon ? "font-semibold text-warn-dark" : ""}`}>
              <ClockIcon size={11} className="shrink-0" />
              {dueSoon ? "Due soon - " : ""}
              {formatDate(gig.dueDate)}
            </span>
          ) : null}
          <span>{timeAgo(gig.createdAt)}</span>
          {gig.isNegotiable ? <span className="font-semibold text-primary-700">Negotiable</span> : null}
        </div>
      </div>
    </Link>
  );
}
