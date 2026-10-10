/**
 * src/components/ui/Badge.tsx
 * WHAT: Small pill-shaped labels: "Verified", "Borehole", "Graduating drop",
 *       escrow states and more.
 * WHY : Badges carry the most important information at a glance on a phone,
 *       where there is no room for sentences.
 */
import { cn } from "@/lib/utils";
import { VerifiedIcon } from "./Icons";

/** Colour themes for badges. */
type Tone = "gold" | "primary" | "slate" | "success" | "danger" | "warn" | "outline";

const toneClasses: Record<Tone, string> = {
  gold: "bg-gold-50 text-gold-800 ring-gold-200",
  primary: "bg-primary-50 text-primary-700 ring-primary-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  success: "bg-success-light text-success-dark ring-success/20",
  danger: "bg-danger-light text-danger-dark ring-danger/20",
  warn: "bg-warn-light text-warn-dark ring-warn/20",
  outline: "bg-white text-slate-600 ring-slate-200",
};

type BadgeProps = {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  icon?: React.ReactNode;
};

/**
 * Badge
 * WHAT: A rounded label with a tone.
 * WHY : One component means every badge has the same height, padding and text
 *       size, so cards stay visually calm.
 */
export function Badge({ children, tone = "slate", className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        toneClasses[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * VerifiedBadge
 * WHAT: The gold "Verified" badge.
 * WHY : It is the single most important trust signal on the platform, so it
 *       gets its own component to guarantee it always looks the same.
 */
export function VerifiedBadge({ label = "Verified", className }: { label?: string; className?: string }) {
  return (
    <Badge tone="gold" className={className} icon={<VerifiedIcon size={12} />}>
      {label}
    </Badge>
  );
}

/**
 * StatusBadge
 * WHAT: Maps a raw status string to the right colour and a human label.
 * WHY : Statuses come from the database in SCREAMING_SNAKE_CASE. The UI needs
 *       colour and plain English in one step.
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    // Verification
    PENDING: { tone: "warn", label: "Pending" },
    APPROVED: { tone: "success", label: "Approved" },
    REJECTED: { tone: "danger", label: "Rejected" },
    NEEDS_MORE_INFO: { tone: "warn", label: "More info needed" },
    // User trust levels
    UNVERIFIED: { tone: "slate", label: "Not verified" },
    PROVISIONAL: { tone: "primary", label: "Provisional" },
    VERIFIED: { tone: "gold", label: "Verified" },
    // Bookings
    REQUESTED: { tone: "primary", label: "Requested" },
    CONFIRMED: { tone: "success", label: "Confirmed" },
    COMPLETED: { tone: "slate", label: "Completed" },
    CANCELLED: { tone: "slate", label: "Cancelled" },
    // Escrow
    PENDING_PAYMENT: { tone: "slate", label: "Awaiting payment" },
    HELD: { tone: "primary", label: "Held safely" },
    RELEASED: { tone: "success", label: "Released" },
    DISPUTED: { tone: "danger", label: "In dispute" },
    REFUNDED: { tone: "slate", label: "Refunded" },
    // Listings
    AVAILABLE: { tone: "success", label: "Available" },
    RESERVED: { tone: "warn", label: "Reserved" },
    SOLD: { tone: "slate", label: "Sold" },
    REMOVED: { tone: "slate", label: "Removed" },
    // Gigs
    OPEN: { tone: "success", label: "Open" },
    ASSIGNED: { tone: "primary", label: "Assigned" },
    IN_PROGRESS: { tone: "primary", label: "In progress" },
    // Reports / disputes
    INVESTIGATING: { tone: "warn", label: "Investigating" },
    RESOLVED: { tone: "success", label: "Resolved" },
    DISMISSED: { tone: "slate", label: "Dismissed" },
    UNDER_REVIEW: { tone: "warn", label: "Under review" },
    OPEN_: { tone: "warn", label: "Open" },
    FILLED: { tone: "success", label: "Filled" },
    CLOSED: { tone: "slate", label: "Closed" },
    EXPIRED: { tone: "slate", label: "Expired" },
    ACCEPTED: { tone: "success", label: "Accepted" },
    DECLINED: { tone: "danger", label: "Declined" },
    WITHDRAWN: { tone: "slate", label: "Withdrawn" },
    ACTIVE: { tone: "success", label: "Active" },
    INACTIVE: { tone: "slate", label: "Inactive" },
  };

  const config = map[status] ?? { tone: "slate" as Tone, label: status.replace(/_/g, " ") };
  return <Badge tone={config.tone} className={className}>{config.label}</Badge>;
}
