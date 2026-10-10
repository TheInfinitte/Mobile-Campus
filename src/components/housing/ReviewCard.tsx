/**
 * src/components/housing/ReviewCard.tsx
 * WHAT: Displays one review of a lodge, plus the form for writing a new one.
 * WHY : Reviews are only allowed from verified past tenants, so showing who wrote
 *       it (name, level, verified tick) is what makes them trustworthy.
 */
"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/SmartImage";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { StarIcon } from "@/components/ui/Icons";
import { timeAgo, truncate } from "@/lib/utils";
import { sendApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

/** One review as returned by the API. */
export type ReviewData = {
  id: string;
  rating: number;
  safety: number | null;
  cleanliness: number | null;
  comment: string;
  isVerifiedTenant: boolean;
  createdAt: string;
  author: { fullName: string; level: string | null; avatarUrl: string | null; isVerified: boolean };
};

/**
 * Stars
 * WHAT: Renders 1-5 stars, filled up to `value`.
 * WHY : Used for both displaying a rating and picking one.
 */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} size={size} filled={star <= value} className={star <= value ? "text-gold-500" : "text-slate-200"} />
      ))}
    </span>
  );
}

/**
 * ReviewCard
 * WHAT: One review, with the author and a "show more" toggle for long text.
 * WHY : Reviews can be long; truncating keeps the list scannable.
 */
export function ReviewCard({ review }: { review: ReviewData }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.comment.length > 160;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      {/* Author row */}
      <div className="flex items-start gap-3">
        <Avatar src={review.author.avatarUrl} name={review.author.fullName} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{review.author.fullName}</p>
            {review.author.isVerified ? <VerifiedBadge label="Verified student" /> : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {review.author.level ?? "Student"} • {timeAgo(review.createdAt)}
          </p>
        </div>
        <Stars value={review.rating} />
      </div>

      {/* The review text */}
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {expanded || !isLong ? review.comment : truncate(review.comment, 160)}
      </p>

      {/* Sub-ratings */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {review.safety ? <Badge tone="slate">Safety {review.safety}/5</Badge> : null}
        {review.cleanliness ? <Badge tone="slate">Cleanliness {review.cleanliness}/5</Badge> : null}
        {review.isVerifiedTenant ? <Badge tone="success">Lived here</Badge> : null}
      </div>

      {isLong ? (
        <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-2 text-xs font-semibold text-primary-700">
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * ReviewForm
 * WHAT: The form for writing a review: rating, safety, cleanliness, comment.
 * WHY : Structured sub-ratings let us show "4.6 for safety" on the listing
 *       summary, which is more useful than a single number.
 */
export function ReviewForm({ lodgeId, onDone }: { lodgeId: string; onDone: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [safety, setSafety] = useState(4);
  const [cleanliness, setCleanliness] = useState(4);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Sends the review to the API and reports the result. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/reviews", "POST", {
      lodgeId,
      rating,
      safety,
      cleanliness,
      comment,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Thank you! Your review is live.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      <h3 className="text-base font-bold text-slate-900">Write a review</h3>
      <p className="mt-1 text-xs text-slate-500">
        Only verified students who have rented here can review. Your review helps the next student avoid a bad lodge.
      </p>

      {/* Star pickers */}
      <div className="mt-4 space-y-3">
        <RatingPicker label="Overall" value={rating} onChange={setRating} />
        <RatingPicker label="Safety of the area" value={safety} onChange={setSafety} />
        <RatingPicker label="Cleanliness" value={cleanliness} onChange={setCleanliness} />
      </div>

      <TextArea
        className="mt-4"
        label="Your experience"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="How was the water? The caretaker? Was the room as described?"
        rows={4}
        error={error}
      />

      <Button type="submit" fullWidth loading={saving} className="mt-3">
        Post review
      </Button>
    </form>
  );
}

/**
 * RatingPicker
 * WHAT: A row of five tappable stars.
 * WHY : Each star is 36px wide so it is easy to hit accurately on a phone.
 */
function RatingPicker({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-50"
          >
            <StarIcon size={22} filled={star <= value} className={star <= value ? "text-gold-500" : "text-slate-300"} />
          </button>
        ))}
      </div>
    </div>
  );
}
