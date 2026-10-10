/**
 * src/components/ui/Card.tsx
 * WHAT: The white, rounded, softly-shadowed surface used for every list item
 *       and panel in the app.
 * WHY : One card definition keeps spacing, radius and shadow identical
 *       everywhere, which is what makes the design feel expensive.
 */
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Adds horizontal padding on small screens only (cards that sit inside a
   *  padded page do not need it twice). */
  padded?: boolean;
  /** Adds a subtle top border highlight - used for "featured" cards. */
  highlighted?: boolean;
};

/**
 * Card
 * WHAT: A container with the standard card treatment.
 * WHY : Used for lodge cards, item cards, escrow rows, admin queue rows...
 */
export function Card({ padded = true, highlighted = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white shadow-card",
        // A hairline border keeps cards readable on very light backgrounds.
        "ring-1 ring-slate-100",
        padded && "p-4",
        highlighted && "ring-2 ring-gold-300",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader
 * WHAT: A title row with an optional action on the right.
 * WHY : Almost every card has "Title ....... See all". This keeps that layout
 *       consistent and accessible (the title is a real heading element).
 */
export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Divider
 * WHAT: A thin horizontal rule.
 * WHY : Sections inside a card need separation without extra padding.
 */
export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-slate-100", className)} />;
}

/**
 * EmptyState
 * WHAT: The friendly "nothing here yet" block with an icon, a message and an
 *       optional call to action.
 * WHY : An empty list with no explanation looks broken. This tells the student
 *       what to do next.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-slate-300">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
