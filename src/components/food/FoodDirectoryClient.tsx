/**
 * src/components/food/FoodDirectoryClient.tsx
 * WHAT: The whole food directory experience - browse vendor cards, filter by
 *       category, order through WhatsApp, visit a vendor's website, suggest a
 *       new spot, and leave star reviews.
 * WHY : This is a SHOWCASE, not a shop. There is deliberately no cart, no
 *       checkout and no delivery engine - the two primary actions are
 *       "Order via WhatsApp" (pre-filled message) and "Visit Website".
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import { useSession } from "@/components/layout/Shell";
import { sendApi } from "@/lib/api-client";
import { whatsappLink,  cn } from "@/lib/utils";
import { formatNaira } from "@/lib/money";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { FOOD_CATEGORIES } from "@/lib/data";
import {
  WhatsAppIcon,
  StarIcon,
  PlusIcon,
  PinIcon,
  SearchIcon,
} from "@/components/ui/Icons";

/** One review as the API returns it. */
type FoodReviewView = {
  rating: number;
  comment: string;
  createdAt: string;
  user: { fullName: string; avatarUrl: string | null };
};

/** One vendor card's data. */
type VendorView = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  priceMinKobo: number;
  priceMaxKobo: number;
  whatsAppNumber: string;
  websiteUrl: string | null;
  imageUrl: string | null;
  area: string;
  isSponsored: boolean;
  ratingAverage: number | null;
  reviewCount: number;
  reviews: FoodReviewView[];
};

/**
 * FoodDirectoryClient
 * WHAT: Category chips + vendor list + suggest modal.
 */
export function FoodDirectoryClient() {
  const toast = useToast();
  const { user } = useSession();
  const [category, setCategory] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);

  // Refetch key: bumping it after a suggestion refreshes the list.
  const [refreshKey, setRefreshKey] = useState(0);
  const url = `/api/food${category ? `?category=${encodeURIComponent(category)}` : ""}${refreshKey ? `${category ? "&" : "?"}r=${refreshKey}` : ""}`;
  const { data, loading } = useFetch<{ vendors: VendorView[] }>(url);
  const vendors = data?.vendors ?? [];

  return (
    <div>
      {/* ------------------------------------------------------------ */}
      {/* CATEGORY CHIPS + SUGGEST BUTTON                                */}
      {/* ------------------------------------------------------------ */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`mc-chip shrink-0 ${!category ? "border-primary-600 bg-primary-600 text-white" : ""}`}
          >
            All
          </button>
          {FOOD_CATEGORIES.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setCategory(chip)}
              className={`mc-chip shrink-0 ${category === chip ? "border-primary-600 bg-primary-600 text-white" : ""}`}
            >
              {chip}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setSuggestOpen(true)} className="shrink-0">
          <PlusIcon size={14} /> Suggest
        </Button>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* VENDOR CARDS                                                   */}
      {/* ------------------------------------------------------------ */}
      {loading ? (
        <p className="px-1 py-8 text-center text-sm text-slate-500">Loading food spots...</p>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={32} />}
          title="No food spots here yet"
          message="Know a great buka or grill spot near campus? Suggest it and an admin will add it to the directory."
          action={
            <Button onClick={() => setSuggestOpen(true)}>
              <PlusIcon size={16} /> Suggest a spot
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} canReview={user?.isVerified === true && user?.role === "STUDENT"} onReviewed={() => setRefreshKey((key) => key + 1)} />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* SUGGESTION MODAL                                               */}
      {/* ------------------------------------------------------------ */}
      <SuggestVendorModal open={suggestOpen} onClose={() => setSuggestOpen(false)} onSuggested={() => {
        setSuggestOpen(false);
        toast.success("Suggestion sent! An admin will review it soon.");
      }} />
    </div>
  );
}

/**
 * VendorCard
 * WHAT: One food spot: photo, name, categories, honest price estimate,
 *       rating, recent reviews, and the two primary action buttons.
 */
function VendorCard({ vendor, canReview, onReviewed }: { vendor: VendorView; canReview: boolean; onReviewed: () => void }) {
  const toast = useToast();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // The pre-filled WhatsApp order message - the vendor sees exactly where
  // the order came from, and the student just adds what they want.
  const orderMessage = `Hi ${vendor.name}! I saw you on the Mobile Campus food directory and I'd like to place an order. My order: `;

  /** Posts the star review. */
  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (comment.trim().length < 5) {
      toast.error("Add a few words about the food.");
      return;
    }
    setSaving(true);
    const result = await sendApi(`/api/food/${vendor.id}/reviews`, "POST", { rating, comment: comment.trim() });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save the review.");
      return;
    }
    toast.success("Review posted - thank you!");
    setReviewOpen(false);
    setComment("");
    onReviewed();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3">
        <SmartImage
          src={vendor.imageUrl}
          alt={vendor.name}
          width={240}
          rounded="lg"
          wrapperClassName="h-24 w-24 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-sm font-bold text-slate-900">{vendor.name}</h3>
            {vendor.isSponsored ? <Badge tone="gold" className="shrink-0">Sponsored</Badge> : null}
          </div>

          {/* Rating + review count. */}
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            {vendor.ratingAverage !== null ? (
              <span className="inline-flex items-center gap-0.5 font-bold text-gold-700">
                <StarIcon size={12} /> {vendor.ratingAverage.toFixed(1)}
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
            <span>&middot; {vendor.reviewCount} review{vendor.reviewCount === 1 ? "" : "s"}</span>
          </p>

          {/* Categories + area. */}
          <div className="mt-1 flex flex-wrap gap-1">
            {vendor.categories.map((chip) => (
              <span key={chip} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {chip}
              </span>
            ))}
          </div>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
            <PinIcon size={11} /> {vendor.area}
          </p>
        </div>
      </div>

      {/* Honest price estimate - the directory never takes orders itself. */}
      <p className="mt-2.5 text-xs font-semibold text-slate-700">
        {formatNaira(vendor.priceMinKobo)} &ndash; {formatNaira(vendor.priceMaxKobo)}{" "}
        <span className="font-normal text-slate-400">estimated per plate</span>
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{vendor.description}</p>

      {/* THE TWO PRIMARY ACTIONS - WhatsApp order and website. No cart. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={whatsappLink(vendor.whatsAppNumber, orderMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-success px-3 text-xs font-bold text-white transition-opacity active:opacity-80"
        >
          <WhatsAppIcon size={16} /> Order via WhatsApp
        </a>
        {vendor.websiteUrl ? (
          <a
            href={vendor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors active:bg-slate-50"
          >
            Visit Website
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            disabled={!canReview}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors active:bg-slate-50 disabled:opacity-50"
          >
            <StarIcon size={14} /> {canReview ? "Leave a review" : "Verified students review"}
          </button>
        )}
      </div>

      {/* Recent reviews. */}
      {vendor.reviews.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {vendor.reviews.map((review, index) => (
            <div key={index} className="rounded-xl bg-slate-50 p-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <span className="inline-flex items-center gap-0.5 text-gold-700">
                  <StarIcon size={11} /> {review.rating}.0
                </span>
                {review.user.fullName}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{review.comment}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Review modal. */}
      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title={`Review ${vendor.name}`}>
        <form onSubmit={submitReview} className="space-y-3">
          {/* Star picker - five big tap targets. */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Your rating</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
                    star <= rating ? "border-gold-300 bg-gold-50 text-gold-700" : "border-slate-200 bg-white text-slate-300"
                  )}
                >
                  <StarIcon size={20} />
                </button>
              ))}
            </div>
          </div>
          <TextArea
            label="How was the food?"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Portion size, taste, how fast they serve..."
            required
          />
          <Button type="submit" fullWidth loading={saving}>
            Post review
          </Button>
        </form>
      </Modal>
    </Card>
  );
}

/**
 * SuggestVendorModal
 * WHAT: The form for suggesting a new food spot. Creates a SUGGESTED record
 *       that only goes live after an admin approves it.
 */
function SuggestVendorModal({ open, onClose, onSuggested }: { open: boolean; onClose: () => void; onSuggested: () => void }) {
  const toast = useToast();
  const areas = useInstitutionAreas();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Flips a category chip on or off (max 4). */
  function toggleCategory(chip: string) {
    setSelectedCategories((current) =>
      current.includes(chip) ? current.filter((item) => item !== chip) : current.length < 4 ? [...current, chip] : current
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedCategories.length === 0) {
      setError("Pick at least one food category.");
      return;
    }
    setSaving(true);
    setError("");
    // Naira input -> kobo for the API.
    const toKobo = (value: string) => Math.round(Number(value.replace(/[^\d.]/g, "")) * 100);
    const result = await sendApi("/api/food/suggestions", "POST", {
      name: name.trim(),
      description: description.trim(),
      categories: selectedCategories,
      priceMinKobo: toKobo(priceMin),
      priceMaxKobo: toKobo(priceMax),
      whatsAppNumber: whatsAppNumber.trim(),
      websiteUrl: websiteUrl.trim() || undefined,
      area: area || areas[0],
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not send the suggestion.");
      return;
    }
    // Reset the form for next time.
    setName("");
    setDescription("");
    setSelectedCategories([]);
    setPriceMin("");
    setPriceMax("");
    setWhatsAppNumber("");
    setWebsiteUrl("");
    onSuggested();
  }

  return (
    <Modal open={open} onClose={onClose} title="Suggest a food spot">
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-xl bg-primary-50 p-3 text-[11px] leading-relaxed text-primary-900">
          Tell us about a food spot near campus. An admin checks every suggestion before it appears on the directory.
        </p>
        <Input label="Spot name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Mama Nkechi's Kitchen" required />
        <TextArea
          label="What makes it good?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Their jollof is legendary and portions are huge..."
          required
        />

        {/* Category chips - tap to toggle, max four. */}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-700">Categories (pick up to 4)</p>
          <div className="flex flex-wrap gap-1.5">
            {FOOD_CATEGORIES.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => toggleCategory(chip)}
                aria-pressed={selectedCategories.includes(chip)}
                className={`min-h-9 rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                  selectedCategories.includes(chip)
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input label="Cheapest plate (₦)" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} inputMode="numeric" placeholder="1200" required />
          <Input label="Priciest plate (₦)" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} inputMode="numeric" placeholder="3000" required />
        </div>
        <Input
          label="Their WhatsApp number"
          value={whatsAppNumber}
          onChange={(event) => setWhatsAppNumber(event.target.value)}
          inputMode="tel"
          placeholder="0803 000 0000"
          hint="Students will order straight through this number."
          required
        />
        <Input label="Website or menu link (optional)" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://..." />
        <Select label="Area" value={area} onChange={(event) => setArea(event.target.value)} options={areas.map((option) => ({ value: option, label: option }))} />

        {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}
        <Button type="submit" fullWidth loading={saving}>
          Send suggestion
        </Button>
      </form>
    </Modal>
  );
}
