/**
 * src/components/gigs/GigForm.tsx
 * WHAT: The form for posting a micro-gig task.
 * WHY : It is short on purpose - a student who needs laundry done should be able
 *       to post it in under thirty seconds.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, TextArea, Checkbox, Segmented } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { GIG_CATEGORIES, SERVICE_CATEGORIES } from "@/lib/data";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { toKobo, formatNaira } from "@/lib/money";

/**
 * GigForm
 * WHAT: Collects the task details and posts them.
 * WHY : Shows a live preview of the budget in naira so the poster knows exactly
 *       what they are offering before submitting.
 */
export function GigForm() {
  // useSearchParams runs inside GigFormInner; this wrapper provides the
  // Suspense boundary Next.js requires for the hook at build time.
  return (
    <Suspense fallback={null}>
      <GigFormInner />
    </Suspense>
  );
}

function GigFormInner() {
  const router = useRouter();
  const toast = useToast();
  // ?gigType=OFFERED on the link pre-selects "I offer a service".
  const searchParams = useSearchParams();

  const [gigType, setGigType] = useState<"WANTED" | "OFFERED">(
    searchParams.get("gigType") === "OFFERED" ? "OFFERED" : "WANTED"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Each side has its own category vocabulary.
  const categories = gigType === "OFFERED" ? SERVICE_CATEGORIES : GIG_CATEGORIES;
  const [category, setCategory] = useState<string>(categories[0]);
  const areas = useInstitutionAreas();
  const [area, setArea] = useState<string>("");
  useEffect(() => {
    if (!area && areas.length > 0) setArea(areas[0]);
  }, [areas, area]);
  useEffect(() => {
    // If the chosen category is not valid on the newly selected side, reset
    // it to the first option of that side's list.
    if (!(categories as readonly string[]).includes(category)) setCategory(categories[0]);
  }, [gigType, categories, category]);

  const [budget, setBudget] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** The budget in kobo, for the live preview. */
  const budgetKobo = budget ? toKobo(Number(budget.replace(/[^\d.]/g, ""))) : 0;

  /** Posts the task. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (title.trim().length < 5) return setError("Describe the task in the title, e.g. 'Wash and iron 15 items'.");
    if (!budgetKobo) return setError("Enter what you are willing to pay.");

    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/gigs", "POST", {
      // Which side of the board this post belongs to.
      gigType,
      title: title.trim(),
      description: description.trim(),
      category,
      area,
      budgetKobo,
      isNegotiable: negotiable,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });

    setSaving(false);

    if (!result.ok || !result.data) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Your task is posted.");
    router.push(`/gigs/${result.data.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <div className="space-y-3">
          {/* BIDIRECTIONAL TOGGLE - hiring help vs offering a service. */}
          <Segmented
            ariaLabel="What are you posting?"
            value={gigType}
            onChange={(value) => setGigType(value as "WANTED" | "OFFERED")}
            options={[
              { value: "WANTED", label: "I need help" },
              { value: "OFFERED", label: "I offer a service" },
            ]}
          />
          <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            {gigType === "OFFERED"
              ? "You are advertising your own skill. Classmates will see your service and hire you - payment still runs through escrow."
              : "You are hiring a classmate. They do the job, you confirm, escrow releases their money."}
          </p>
          <Input
            label={gigType === "OFFERED" ? "What service do you offer?" : "What do you need done?"}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={gigType === "OFFERED" ? "Braiding, styling and wash - same day" : "Wash and iron my clothes this week"}
            required
          />
          <TextArea
            label="Details"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder={gigType === "OFFERED" ? "What is included? How long does it take? Where do clients meet you?" : "How many items? Where should they be collected? Anything the person should know?"}
            required
          />
          <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)} options={GIG_CATEGORIES.map((option) => ({ value: option, label: option }))} />
          <Select label="Area" value={area} onChange={(event) => setArea(event.target.value)} options={areas.map((option) => ({ value: option, label: option }))} />
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <Input
            label={gigType === "OFFERED" ? "Your price (₦)" : "What will you pay? (₦)"}
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            inputMode="numeric"
            placeholder="4000"
            hint={budgetKobo > 0 ? `That is ${formatNaira(budgetKobo)}` : undefined}
            required
          />
          <Input label="Needed by" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} min={new Date().toISOString().slice(0, 16)} />
          <Checkbox checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} label="I am open to negotiating the price" />
        </div>
      </Card>

      <p className="rounded-xl bg-primary-50 p-3 text-[11px] leading-relaxed text-primary-900">
        {gigType === "OFFERED"
          ? "When someone hires you, their money sits in escrow until you finish and they confirm - then it is released to you. A 3% escrow fee is added at their checkout."
          : "When someone accepts, you pay into escrow. The money is released to them only after you confirm the job was done properly. A 3% escrow fee is added at checkout - you will see the exact total before paying."}
      </p>

      {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

      <Button type="submit" fullWidth loading={saving}>
        {gigType === "OFFERED" ? "Publish my service" : "Post task"}
      </Button>
    </form>
  );
}
