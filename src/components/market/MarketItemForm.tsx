/**
 * src/components/market/MarketItemForm.tsx
 * WHAT: The form for listing an item on the marketplace, with photo upload and
 *       the "I am graduating" toggle.
 * WHY : A student clearing out before graduation wants this done in under a
 *       minute. Photos first, price second, done.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, TextArea, Checkbox } from "@/components/ui/Input";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { MARKET_CATEGORIES } from "@/lib/data";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { toKobo } from "@/lib/money";

/**
 * MarketItemForm
 * WHAT: Collects the item details and posts them to /api/market.
 * WHY : Money is typed in naira and converted to kobo here, matching what the
 *       database stores.
 */
export function MarketItemForm({ isFinalYear }: { isFinalYear: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(MARKET_CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [lowestPrice, setLowestPrice] = useState("");
  const [condition, setCondition] = useState("Used");
  const areas = useInstitutionAreas();
  const [area, setArea] = useState<string>("");
  useEffect(() => {
    if (!area && areas.length > 0) setArea(areas[0]);
  }, [areas, area]);
  const [pickupNote, setPickupNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [graduatingDrop, setGraduatingDrop] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Posts the listing. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    // Local checks first - no point spending data on an invalid request.
    if (title.trim().length < 5) return setError("Give the item a clear title, e.g. 'Binatone standing fan'.");
    if (!price) return setError("Enter a price.");
    if (images.length === 0) return setError("Add at least one photo - items without photos rarely sell.");

    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/market", "POST", {
      title: title.trim(),
      description: description.trim(),
      category,
      priceKobo: toKobo(Number(price.replace(/[^\d.]/g, ""))),
      negotiableMinKobo: lowestPrice ? toKobo(Number(lowestPrice.replace(/[^\d.]/g, ""))) : undefined,
      condition,
      area,
      pickupNote: pickupNote || undefined,
      images,
      // Only final-year students can flag a graduating drop; the server checks too.
      isGraduatingDrop: graduatingDrop && isFinalYear,
    });

    setSaving(false);

    if (!result.ok || !result.data) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Your item is live.");
    router.push(`/market/${result.data.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <p className="text-sm font-bold text-slate-900">Photos</p>
        <p className="mt-0.5 text-xs text-slate-500">The first photo is the cover. Bright, clear photos sell fastest.</p>
        <div className="mt-3">
          <ImageUploader onChange={setImages} maxImages={6} folder="market" label="Item photos" />
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Sumec Firman 2.5KVA generator" required />
          <TextArea
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="How old is it? Does it work perfectly? What comes with it?"
            required
          />
          <Select
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={MARKET_CATEGORIES.map((option) => ({ value: option, label: option }))}
          />
          <Select
            label="Area"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            options={areas.map((option) => ({ value: option, label: option }))}
          />
          <Select
            label="Condition"
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
            options={[
              { value: "New", label: "New" },
              { value: "Fairly used", label: "Fairly used" },
              { value: "Used", label: "Used" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <Input label="Price (₦)" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" placeholder="95000" required />
          <Input
            label="Lowest you would accept (₦)"
            value={lowestPrice}
            onChange={(event) => setLowestPrice(event.target.value)}
            inputMode="numeric"
            placeholder="85000"
            hint="Optional. Buyers see 'Negotiable' and the AI assistant can suggest it."
          />
          <Input label="Pickup note" value={pickupNote} onChange={(event) => setPickupNote(event.target.value)} placeholder="Pickup at Ekrejeta Road, or I can meet you at the gate" />
        </div>
      </Card>

      {/* The graduating drop flag - only offered to final-year students. */}
      {isFinalYear ? (
        <Checkbox
          checked={graduatingDrop}
          onChange={(event) => setGraduatingDrop(event.target.checked)}
          label="Add to the Graduating Student Drop"
          description="Your item gets a gold badge and appears in a featured section. These sell fastest."
        />
      ) : null}

      {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

      <Button type="submit" fullWidth loading={saving}>
        List item
      </Button>
    </form>
  );
}
