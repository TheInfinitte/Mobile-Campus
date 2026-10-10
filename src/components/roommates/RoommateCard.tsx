/**
 * src/components/roommates/RoommateCard.tsx
 * WHAT: Two cards for the roommate feature:
 *       1. RoommatePostCard - a post on the Roommate Board ("3 of us need 1 more").
 *       2. MatchCard - a suggested match with a compatibility score.
 * WHY : These are the two things a student sees when looking for someone to live
 *       with, and both need the same visual language.
 */
import Link from "next/link";
import { Avatar } from "@/components/ui/SmartImage";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { MoneyChip } from "@/components/ui/Money";
import { PeopleIcon, PinIcon } from "@/components/ui/Icons";
import { formatDate, timeAgo, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** A roommate board post as returned by the API. */
export type RoommatePostData = {
  id: string;
  title: string;
  description: string;
  area: string;
  groupSize: number;
  slotsLeft: number;
  budgetPerPersonKobo: number;
  moveInDate: string | null;
  status: string;
  createdAt: string;
  author: { fullName: string; avatarUrl: string | null; level: string | null; isVerified: boolean };
  compatibilityScore?: number;
};

/**
 * RoommatePostCard
 * WHAT: One board post with a "slots left" indicator.
 * WHY : Showing how many people are still needed creates the right urgency
 *       without being pushy.
 */
export function RoommatePostCard({ post }: { post: RoommatePostData }) {
  const filled = post.groupSize - post.slotsLeft;

  return (
    <Link
      href={`/roommates/${post.id}`}
      className="block rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Avatar src={post.author.avatarUrl} name={post.author.fullName} size={42} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-900">{post.author.fullName}</p>
            {post.author.isVerified ? <VerifiedBadge label="Verified" /> : null}
            {post.author.level ? <Badge tone="slate">{post.author.level}</Badge> : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Posted {timeAgo(post.createdAt)}</p>
        </div>

        {/* Compatibility score, when we have one for the signed-in user. */}
        {typeof post.compatibilityScore === "number" ? (
          <ScoreRing score={post.compatibilityScore} />
        ) : null}
      </div>

      <h3 className="mt-3 text-sm font-bold leading-snug text-slate-900">{post.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{truncate(post.description, 150)}</p>

      {/* Slots visual: filled dots + empty dots. */}
      <div className="mt-3 flex items-center gap-1.5">
        <PeopleIcon size={14} className="text-slate-400" />
        <div className="flex gap-1">
          {Array.from({ length: post.groupSize }).map((_, index) => (
            <span
              key={index}
              className={cn("h-2.5 w-2.5 rounded-full", index < filled ? "bg-primary-500" : "bg-slate-200")}
            />
          ))}
        </div>
        <span className="ml-1 text-[11px] font-semibold text-slate-600">
          {post.slotsLeft} spot{post.slotsLeft === 1 ? "" : "s"} left
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <Badge tone="primary" icon={<PinIcon size={11} />}>
          {post.area}
        </Badge>
        <MoneyChip kobo={post.budgetPerPersonKobo} suffix="/person" tone="gold" />
        {post.moveInDate ? <Badge tone="slate">Move in {formatDate(post.moveInDate)}</Badge> : null}
      </div>
    </Link>
  );
}

/**
 * ScoreRing
 * WHAT: A small circular percentage showing compatibility.
 * WHY : A ring reads faster than a number and looks premium. Built with SVG so
 *       it is crisp at any size and costs no extra assets.
 */
export function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  // How much of the ring to fill, from 0 to the full circumference.
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  // Colour the ring by how good the match is.
  const color = score >= 80 ? "#0d9488" : score >= 60 ? "#4f46e5" : score >= 40 ? "#f59e0b" : "#94a3b8";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`${score}% compatible`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-slate-800"
      >
        {score}
      </span>
    </div>
  );
}

/** A suggested match (a person, not a post). */
export type MatchData = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  level: string | null;
  department: string | null;
  isVerified: boolean;
  score: number;
  label: string;
  reasons: string[];
  warnings: string[];
  budgetKobo: number;
  preferredAreas: string[];
};

/**
 * MatchCard
 * WHAT: A suggested roommate with the compatibility score and the reasons.
 * WHY : A number alone is not useful. "You both read at night" is what makes a
 *       student send a message.
 */
export function MatchCard({ match }: { match: MatchData }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      <div className="flex items-start gap-3">
        <Avatar src={match.avatarUrl} name={match.fullName} size={46} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-900">{match.fullName}</p>
            {match.isVerified ? <VerifiedBadge label="Verified" /> : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {[match.level, match.department].filter(Boolean).join(" • ") || "Student"}
          </p>
        </div>

        <ScoreRing score={match.score} />
      </div>

      <p className="mt-2.5 text-xs font-semibold text-primary-700">{match.label}</p>

      {/* Reasons - the good news first. */}
      {match.reasons.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {match.reasons.slice(0, 2).map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-xs text-slate-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Warnings - things to discuss before moving in. */}
      {match.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {match.warnings.slice(0, 2).map((warning) => (
            <li key={warning} className="flex items-start gap-1.5 text-xs text-slate-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <MoneyChip kobo={match.budgetKobo} suffix="/month max" />
        {match.preferredAreas.slice(0, 2).map((area) => (
          <Badge key={area} tone="slate">
            {area}
          </Badge>
        ))}
      </div>

      <Link href={`/roommates/matches/${match.userId}`} className="mc-btn-secondary mt-3 w-full">
        View profile
      </Link>
    </div>
  );
}
