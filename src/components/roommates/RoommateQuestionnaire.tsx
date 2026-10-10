/**
 * src/components/roommates/RoommateQuestionnaire.tsx
 * WHAT: The short compatibility questionnaire (sleep, study, cleanliness, noise,
 *       budget, habits) that powers roommate matching.
 * WHY : Six questions is the maximum a student will answer on a phone. Each one
 *       maps directly to a weight in the compatibility score, so nothing here is
 *       decorative.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select, TextArea, Checkbox } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { SLEEP_SCHEDULES, STUDY_STYLES, GENDER_OPTIONS } from "@/lib/data";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { toKobo, formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";

/** The saved profile, when the user is editing an existing one. */
export type RoommateProfileData = {
  sleepSchedule: string;
  studyStyle: string;
  cleanliness: number;
  noiseTolerance: number;
  budgetKobo: number;
  smokes: boolean;
  hasPets: boolean;
  hasGenerator: boolean;
  hasFridge: boolean;
  aboutMe: string | null;
  preferredAreas: string[];
} | null;

/**
 * RoommateQuestionnaire
 * WHAT: Collects the answers and saves them.
 * WHY : The scale pickers (cleanliness, noise) use five big tap targets instead
 *       of a slider - far easier to hit accurately on a phone.
 */
export function RoommateQuestionnaire({ initial, initialGender }: { initial: RoommateProfileData; initialGender?: string | null }) {
  const router = useRouter();
  const toast = useToast();

  const [sleepSchedule, setSleepSchedule] = useState(initial?.sleepSchedule ?? "flexible");
  const [studyStyle, setStudyStyle] = useState(initial?.studyStyle ?? "library");
  const [cleanliness, setCleanliness] = useState(initial?.cleanliness ?? 3);
  const [noiseTolerance, setNoiseTolerance] = useState(initial?.noiseTolerance ?? 3);
  const [budget, setBudget] = useState(initial ? String(initial.budgetKobo / 100) : "");
  const [smokes, setSmokes] = useState(initial?.smokes ?? false);
  const [hasPets, setHasPets] = useState(initial?.hasPets ?? false);
  const [hasGenerator, setHasGenerator] = useState(initial?.hasGenerator ?? false);
  const [hasFridge, setHasFridge] = useState(initial?.hasFridge ?? false);
  // SAME-GENDER RULE: gender is required and drives all matching.
  const [gender, setGender] = useState(initialGender ?? "");
  const [aboutMe, setAboutMe] = useState(initial?.aboutMe ?? "");
  const [preferredAreas, setPreferredAreas] = useState<string[]>(initial?.preferredAreas ?? []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // MULTI-CAMPUS: area chips come from the viewer's institution.
  const areas = useInstitutionAreas();

  /** Toggles an area chip. */
  function toggleArea(area: string) {
    setPreferredAreas((current) => (current.includes(area) ? current.filter((item) => item !== area) : [...current, area]));
  }

  /** Saves the answers. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const budgetKobo = budget ? toKobo(Number(budget.replace(/[^\d.]/g, ""))) : 0;
    if (!budgetKobo) {
      setError("Enter the most you can pay per month.");
      return;
    }
    if (!gender) {
      setError("Select your gender - matching is same-gender only.");
      return;
    }

    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/roommates/profile", "POST", {
      sleepSchedule,
      studyStyle,
      cleanliness,
      noiseTolerance,
      budgetKobo,
      smokes,
      hasPets,
      hasGenerator,
      hasFridge,
      gender,
      aboutMe: aboutMe || undefined,
      preferredAreas,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Saved. Here are your matches.");
    router.push("/roommates/matches");
  }

  const budgetKobo = budget ? toKobo(Number(budget.replace(/[^\d.]/g, ""))) : 0;

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* --------------------------------------------------------------- */}
      {/* SLEEP AND STUDY                                                  */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Your habits" subtitle="The biggest source of roommate conflict is sleep - be honest" />

        <div className="mt-3 space-y-4">
          <div>
            <p className="mc-label">When do you sleep?</p>
            <div className="space-y-2">
              {SLEEP_SCHEDULES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSleepSchedule(option.value)}
                  aria-pressed={sleepSchedule === option.value}
                  className={cn(
                    "flex min-h-[44px] w-full items-center rounded-xl border px-3.5 text-left text-sm font-medium transition-colors",
                    sleepSchedule === option.value ? "border-primary-600 bg-primary-50 text-primary-800" : "border-slate-200 text-slate-700"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Select
            label="How do you study?"
            value={studyStyle}
            onChange={(event) => setStudyStyle(event.target.value)}
            options={STUDY_STYLES.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>
      </Card>

      {/* --------------------------------------------------------------- */}
      {/* SCALES                                                           */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Cleanliness and noise" subtitle="1 = very low, 5 = very high" />
        <div className="mt-3 space-y-4">
          <ScalePicker label="How neat are you?" value={cleanliness} onChange={setCleanliness} lowLabel="Messy is fine" highLabel="Spotless" />
          <ScalePicker label="How much noise can you take?" value={noiseTolerance} onChange={setNoiseTolerance} lowLabel="I need silence" highLabel="Noise is fine" />
        </div>
      </Card>

      {/* --------------------------------------------------------------- */}
      {/* BUDGET AND PREFERENCES                                           */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Budget and preferences" />
        <div className="mt-3 space-y-3">
          <Input
            label="Maximum monthly rent (₦)"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            inputMode="numeric"
            placeholder="40000"
            hint={budgetKobo ? `That is ${formatNaira(budgetKobo)} a month` : undefined}
            required
          />

          <div>
            <p className="mc-label">I am (used only for same-gender matching)</p>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGender(option.value)}
                  aria-pressed={gender === option.value}
                  className={cn(
                    "min-h-[44px] flex-1 rounded-xl border text-sm font-semibold transition-colors",
                    gender === option.value ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 text-slate-700"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">For your safety, matches are always same-gender.</p>
          </div>

          <div>
            <p className="mc-label">Areas you would stay in</p>
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  aria-pressed={preferredAreas.includes(area)}
                  className={cn(
                    "min-h-[36px] rounded-full border px-3.5 text-xs font-semibold transition-colors",
                    preferredAreas.includes(area) ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 text-slate-700"
                  )}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <TextArea label="About you" value={aboutMe} onChange={(event) => setAboutMe(event.target.value)} rows={3} placeholder="What should a roommate know about living with you?" />
        </div>
      </Card>

      {/* --------------------------------------------------------------- */}
      {/* THINGS YOU BRING                                                 */}
      {/* --------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Things you already have" subtitle="A generator or a fridge makes you a very popular match" />
        <div className="mt-3 space-y-2">
          <Checkbox checked={hasGenerator} onChange={(event) => setHasGenerator(event.target.checked)} label="I have a generator" />
          <Checkbox checked={hasFridge} onChange={(event) => setHasFridge(event.target.checked)} label="I have a fridge" />
          <Checkbox checked={smokes} onChange={(event) => setSmokes(event.target.checked)} label="I smoke" />
          <Checkbox checked={hasPets} onChange={(event) => setHasPets(event.target.checked)} label="I have a pet" />
        </div>
      </Card>

      {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

      <Button type="submit" fullWidth loading={saving}>
        {initial ? "Save and see my matches" : "Find my matches"}
      </Button>
    </form>
  );
}

/**
 * ScalePicker
 * WHAT: Five big tap targets for a 1-5 rating.
 * WHY : A range slider is hard to use on a phone and gives no feedback about
 *       what each position means.
 */
function ScalePicker({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <p className="mc-label">{label}</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            aria-label={`${option} out of 5`}
            onClick={() => onChange(option)}
            className={cn(
              "h-11 flex-1 rounded-xl border text-sm font-bold transition-colors",
              value === option ? "border-primary-600 bg-primary-600 text-white" : "border-slate-200 text-slate-600"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
