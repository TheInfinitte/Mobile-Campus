/**
 * src/components/budget/BudgetResultCard.tsx
 * WHAT: The animated result cards the AI Budget Assistant shows: matched lodges,
 *       items and gigs, plus the affordability breakdown panel.
 * WHY : This is the payoff of the whole feature. The cards must make it obvious
 *       at a glance whether the option fits the budget, and the breakdown must
 *       show exactly how the total was built.
 */
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { Money, MoneyRow, MoneyTotal } from "@/components/ui/Money";
import { SparkleIcon } from "@/components/ui/Icons";
import { formatNaira, formatNairaCompact } from "@/lib/money";
import { walkTime, cn } from "@/lib/utils";
import type { BudgetPlan, MatchedGig, MatchedItem, MatchedLodge } from "@/types/budget";

/** Colour for the fit label: green if it fits, gold if it is a big saving, red if not. */
function fitTone(label: string): "success" | "gold" | "danger" {
  if (label.startsWith("Saves")) return "gold";
  if (label.startsWith("Over") || label.startsWith("Short")) return "danger";
  return "success";
}

/**
 * LodgeMatchCard
 * WHAT: One lodge the assistant matched, with a "why" label.
 * WHY : The label ("Within budget", "Saves you ₦12,000") is the single most
 *       useful piece of information on the card.
 */
export function LodgeMatchCard({ lodge, index }: { lodge: MatchedLodge; index: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.07, 0.4), ease: "easeOut" }}
    >
      <Link
        href={`/housing/${lodge.id}`}
        className="flex gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-100"
      >
        <SmartImage src={lodge.coverImage} alt={lodge.title} width={200} rounded="xl" wrapperClassName="h-24 w-24 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="line-clamp-1 text-sm font-semibold text-slate-900">{lodge.title}</h4>
            <Badge tone={fitTone(lodge.fitLabel)} className="shrink-0">
              {lodge.fitLabel}
            </Badge>
          </div>

          <p className="mt-0.5 text-[11px] text-slate-500">
            {lodge.area} • {lodge.roomType} • {walkTime(lodge.distanceToMainGateMeters)}
          </p>

          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge tone="outline">{lodge.waterSource}</Badge>
            <Badge tone="outline">{lodge.meterType}</Badge>
          </div>

          <div className="mt-1.5 flex items-baseline justify-between">
            <Money kobo={lodge.annualRentKobo} size="sm" className="text-primary-700" suffix="/year" />
            <span className="text-[10px] text-slate-400">Total move-in {formatNairaCompact(lodge.totalKobo)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/**
 * ItemMatchCard
 * WHAT: A matched market item.
 * WHY : Kept smaller than the lodge card because items are cheaper decisions.
 */
export function ItemMatchCard({ item, index }: { item: MatchedItem; index: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.07, 0.4), ease: "easeOut" }}
    >
      <Link
        href={`/market/${item.id}`}
        className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-100"
      >
        <SmartImage src={item.image} alt={item.title} width={160} rounded="lg" wrapperClassName="h-14 w-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {item.category} • {item.area} • {item.condition}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Money kobo={item.priceKobo} size="sm" className="text-primary-700" />
          <p className={cn("mt-0.5 text-[10px] font-semibold", item.fitLabel.startsWith("Saves") ? "text-gold-700" : "text-success-dark")}>
            {item.fitLabel}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

/**
 * GigMatchCard
 * WHAT: A matched micro-gig.
 * WHY : Included so a student who said "I need to earn something too" sees real
 *       tasks they could pick up.
 */
export function GigMatchCard({ gig, index }: { gig: MatchedGig; index: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.07, 0.4), ease: "easeOut" }}
    >
      <Link href={`/gigs/${gig.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-100">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50">
          <Money kobo={gig.budgetKobo} size="xs" className="text-primary-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-semibold text-slate-900">{gig.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {gig.category} • {gig.area}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-success-dark">{gig.fitLabel}</p>
        </div>
      </Link>
    </motion.div>
  );
}

/**
 * AffordabilityPanel
 * WHAT: The rent + caution + fee + move-in items = total breakdown, compared with
 *       what the student said they have.
 * WHY : This answers the real question - "can I actually afford to move in?" -
 *       and shows the roommate split as a way out when they cannot.
 */
export function AffordabilityPanel({ plan }: { plan: BudgetPlan }) {
  const breakdown = plan.breakdown;
  if (!breakdown) return null;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
      {/* Verdict banner */}
      <div
        className={cn(
          "flex items-start gap-2.5 p-4",
          breakdown.affordable ? "bg-success-light" : "bg-warn-light"
        )}
      >
        <SparkleIcon size={20} className={cn("mt-0.5 shrink-0", breakdown.affordable ? "text-success-dark" : "text-warn-dark")} />
        <div>
          <p className={cn("text-sm font-bold", breakdown.affordable ? "text-success-dark" : "text-warn-dark")}>
            {breakdown.affordable ? "You can afford this" : "You are short"}
          </p>
          <p className={cn("mt-0.5 text-xs leading-relaxed", breakdown.affordable ? "text-success-dark" : "text-warn-dark")}>
            {breakdown.message}
          </p>
        </div>
      </div>

      {/* The maths */}
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Move-in cost for {breakdown.lodgeTitle}</p>

        <div className="mt-2">
          <MoneyRow label="Rent (12 months)" kobo={breakdown.rentKobo} />
          <MoneyRow label="Caution deposit" kobo={breakdown.cautionKobo} hint="Refundable when you move out" muted />
          <MoneyRow label="Mobile Campus fee" kobo={breakdown.platformFeeKobo} hint="1% tenant commission" muted />
          <MoneyRow label="Move-in items" kobo={breakdown.moveInItemsKobo} hint="Fan, mattress and gas cylinder" muted />
        </div>

        <MoneyTotal label="Total you need" kobo={breakdown.totalKobo} hint={`You said you have ${formatNaira(plan.intent.totalBudgetKobo)}`} />

        {/* The roommate suggestion - the way out when they are short. */}
        {breakdown.splitWithRoommateKobo > 0 ? (
          <div className="mt-4 rounded-xl bg-primary-50 p-3">
            <p className="text-xs font-bold text-primary-900">Smart split</p>
            <p className="mt-1 text-[11px] leading-relaxed text-primary-800">{breakdown.splitMessage}</p>
            <Link href="/roommates" className="mc-btn-primary mt-2.5 h-10 w-full text-xs">
              Find a roommate
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
