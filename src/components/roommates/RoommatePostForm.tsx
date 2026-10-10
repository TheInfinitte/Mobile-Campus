/**
 * src/components/roommates/RoommatePostForm.tsx
 * WHAT: The form for posting on the Roommate Board ("3 of us need 1 more").
 * WHY : The key field is `groupSize` - it drives the slots indicator and lets the
 *       platform support groups of 2, 3, 4 or more.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { toKobo, formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * RoommatePostForm
 * WHAT: Collects the post details and submits them.
 * WHY : Shows the total rent implied by group size x budget, which helps the
 *       poster set a realistic number.
 */
export function RoommatePostForm() {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const areas = useInstitutionAreas();
  const [area, setArea] = useState<string>("");
  // Pick the first community once the institution's list arrives.
  useEffect(() => {
    if (!area && areas.length > 0) setArea(areas[0]);
  }, [areas, area]);
  const [groupSize, setGroupSize] = useState(2);
  const [budget, setBudget] = useState("");
  const [moveInDate, setMoveInDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const budgetPerPersonKobo = budget ? toKobo(Number(budget.replace(/[^\d.]/g, ""))) : 0;

  /** Posts to the board. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (title.trim().length < 5) return setError("Write a clear title, e.g. 'Need 1 more for a 3-room flat in Ajalomi'.");
    if (!budgetPerPersonKobo) return setError("Enter the budget per person.");

    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/roommates/posts", "POST", {
      title: title.trim(),
      description: description.trim(),
      area,
      groupSize,
      budgetPerPersonKobo,
      moveInDate: moveInDate ? new Date(moveInDate).toISOString() : undefined,
    });

    setSaving(false);

    if (!result.ok || !result.data) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Posted on the board.");
    router.push("/roommates");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <div className="space-y-3">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Looking for 1 more neat girl for a double self-contain" required />
          <TextArea
            label="Tell people about the group"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="Who is already in the group? What are you looking for? When do you want to move in?"
            required
          />
          <Select label="Area" value={area} onChange={(event) => setArea(event.target.value)} options={areas.map((option) => ({ value: option, label: option }))} />
        </div>
      </Card>

      <Card>
        <p className="mc-label">How many people in total?</p>
        {/* Big tap targets for group size - the most important number here. */}
        <div className="grid grid-cols-4 gap-2">
          {[2, 3, 4, 5].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setGroupSize(size)}
              aria-pressed={groupSize === size}
              className={cn(
                "h-11 rounded-xl border text-sm font-bold transition-colors",
                groupSize === size ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 text-slate-600"
              )}
            >
              {size}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          That is {groupSize - 1} more {groupSize - 1 === 1 ? "person" : "people"} to find (you are already one).
        </p>

        <div className="mt-4 space-y-3">
          <Input
            label="Budget per person, per month (₦)"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            inputMode="numeric"
            placeholder="32500"
            hint={budgetPerPersonKobo ? `The group could afford about ${formatNaira(budgetPerPersonKobo * groupSize)} a month together` : undefined}
            required
          />
          <Input label="Move-in date" type="date" value={moveInDate} onChange={(event) => setMoveInDate(event.target.value)} min={new Date().toISOString().slice(0, 10)} />
          <p className="rounded-xl bg-primary-50 p-3 text-xs font-medium text-primary-800">
            For safety, applications are same-gender only - based on each student's questionnaire answer.
          </p>
        </div>
      </Card>

      {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

      <Button type="submit" fullWidth loading={saving}>
        Post on the board
      </Button>
    </form>
  );
}
