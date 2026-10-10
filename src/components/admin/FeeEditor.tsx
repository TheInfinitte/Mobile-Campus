/**
 * src/components/admin/FeeEditor.tsx
 * WHAT: Edits one fee rule at a time, with a live preview of what a sample
 *       transaction would cost.
 * WHY : Changing a fee affects every deal on the platform, so the preview answers
 *       "what will a ₦100,000 rent actually cost the student?" before you save.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select, Checkbox } from "@/components/ui/Input";
import { Celebration } from "@/components/ui/Celebration";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { MoneyIcon, InfoIcon } from "@/components/ui/Icons";
import { formatNaira, toKobo, percentOf, clampFee } from "@/lib/money";

/** One fee rule as stored in FeeConfig. */
export type FeeRow = {
  id: string;
  key: string;
  label: string;
  percent: number;
  fixedKobo: number;
  minimumKobo: number;
  maximumKobo: number;
  payer: "PAYER" | "PAYEE" | "SPLIT";
  isActive: boolean;
  updatedAt: string;
};

/**
 * FeeEditor
 * WHAT: Renders one editable card per fee rule.
 */
export function FeeEditor({ fees }: { fees: FeeRow[] }) {
  return (
    <div className="space-y-4">
      <Card className="bg-primary-50">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-primary-900">
          <InfoIcon size={15} className="mt-px shrink-0 text-primary-600" />
          The percentage is charged on the rent, item price or task fee. The fixed amount is added on top. The minimum stops tiny
          deals costing us money; the maximum caps what we take from a very large one. Set the maximum to 0 for no cap.
        </p>
      </Card>

      {fees.map((fee) => (
        <FeeCard key={fee.id} fee={fee} />
      ))}
    </div>
  );
}

/**
 * FeeCard
 * WHAT: One editable fee rule with a live preview.
 * WHY : Keeping each rule in its own card means an admin edits one thing at a
 *       time and cannot accidentally save the wrong rule.
 */
function FeeCard({ fee }: { fee: FeeRow }) {
  const router = useRouter();
  const toast = useToast();

  const [label, setLabel] = useState(fee.label);
  const [percent, setPercent] = useState(String(fee.percent));
  const [fixed, setFixed] = useState(String(fee.fixedKobo / 100));
  const [minimum, setMinimum] = useState(String(fee.minimumKobo / 100));
  const [maximum, setMaximum] = useState(String(fee.maximumKobo / 100));
  const [payer, setPayer] = useState(fee.payer);
  const [isActive, setIsActive] = useState(fee.isActive);

  // The preview always assumes a ₦100,000 transaction - an easy number to check
  // the maths against by hand.
  const sampleKobo = 100_000 * 100;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const percentValue = Number(percent.replace(/\D/g, "")) || 0;
  const fixedKobo = toKobo(Number(fixed.replace(/[^\d.]/g, "")) || 0);
  const minimumKobo = toKobo(Number(minimum.replace(/[^\d.]/g, "")) || 0);
  const maximumKobo = toKobo(Number(maximum.replace(/[^\d.]/g, "")) || 0);

  // The exact same helpers the payment routes use, so the preview cannot lie.
  const rawFeeKobo = percentOf(sampleKobo, percentValue) + fixedKobo;
  const previewKobo = clampFee(rawFeeKobo, minimumKobo, maximumKobo);

  /** Saves this rule. */
  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (label.trim().length < 3) {
      setError("Give this fee a short label students will understand.");
      return;
    }

    setSaving(true);
    setError("");

    const result = await sendApi<{ fee: unknown }>("/api/admin/fees", "PATCH", {
      key: fee.key,
      label: label.trim(),
      percent: percentValue,
      fixedKobo,
      minimumKobo,
      maximumKobo,
      payer,
      isActive,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    setSaved(true);
    toast.success("Fee updated. It applies to new payments immediately.");
    router.refresh();
  }

  return (
    <form onSubmit={save}>
      <Card>
        <CardHeader
          title={fee.label}
          subtitle={`Key: ${fee.key}${!isActive ? " · switched off" : ""}`}
          action={
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                isActive ? "bg-success-light text-success-dark" : "bg-slate-100 text-slate-500"
              }`}
            >
              {payer === "SPLIT" ? "split" : payer === "PAYER" ? "payer pays" : "payee pays"}
            </span>
          }
        />

        <div className="mt-3 space-y-3">
          <Input label="Label shown to users" value={label} onChange={(event) => setLabel(event.target.value)} required />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Percent (%)" value={percent} onChange={(event) => setPercent(event.target.value)} inputMode="numeric" hint="1 means 1%" />
            <Input label="Fixed add-on (₦)" value={fixed} onChange={(event) => setFixed(event.target.value)} inputMode="decimal" hint="0 for none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Minimum fee (₦)" value={minimum} onChange={(event) => setMinimum(event.target.value)} inputMode="decimal" />
            <Input label="Maximum fee (₦)" value={maximum} onChange={(event) => setMaximum(event.target.value)} inputMode="decimal" hint="0 = no cap" />
          </div>

          <Select
            label="Who pays it"
            value={payer}
            onChange={(event) => setPayer(event.target.value as "PAYER" | "PAYEE" | "SPLIT")}
            options={[
              { value: "PAYER", label: "The person paying" },
              { value: "PAYEE", label: "The person receiving" },
              { value: "SPLIT", label: "Split between both" },
            ]}
          />

          <Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} label="This fee is active" description="Switch it off to stop charging it. Existing payments keep the fee they were created with." />
        </div>

        {/* The preview - the safety check before saving. */}
        <div className="mt-3 rounded-xl bg-slate-900 p-3 text-white">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <MoneyIcon size={12} />
            Preview on a {formatNaira(sampleKobo)} payment
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatNaira(previewKobo)}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {percentValue}% {fixedKobo > 0 ? `+ ${formatNaira(fixedKobo)} fixed` : ""}
            {minimumKobo > 0 ? `, minimum ${formatNaira(minimumKobo)}` : ""}
            {maximumKobo > 0 ? `, capped at ${formatNaira(maximumKobo)}` : ""}
          </p>
        </div>

        {error ? <p className="mt-3 rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

        <Button type="submit" fullWidth className="mt-3" loading={saving}>
          Save this fee
        </Button>
      </Card>

      <Celebration
        open={saved}
        onClose={() => setSaved(false)}
        variant="check"
        title="Fee saved"
        message="New payments will use this rule. Payments already made keep the fee they were charged."
      />
    </form>
  );
}
