/**
 * src/components/housing/ChecklistForm.tsx
 * WHAT: The move-in and move-out condition checklist. Both the tenant and the
 *       landlord tick the same list of items and can add photos and notes.
 * WHY : Caution-deposit disputes are one of the most common problems in Nigerian
 *       student housing. A signed, timestamped record of the room's condition on
 *       day one makes the argument impossible to have on day 365.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckIcon, CloseIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { sendApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

/** One line on the checklist. */
type ChecklistItem = {
  item: string;
  ok: boolean;
  note: string;
};

/** The default items every DELSU room should be checked for. */
const DEFAULT_ITEMS: string[] = [
  "Door and lock working",
  "Windows and burglar proof intact",
  "Floor and wall tiles undamaged",
  "Water taps and pipes not leaking",
  "Toilet and bathroom fittings working",
  "Electricity points and switches working",
  "Light bulbs and fittings present",
  "Room painted and clean",
  "Wardrobe / shelves present and undamaged",
  "Keys handed over (number recorded)",
  "Meter reading recorded",
];

type ChecklistFormProps = {
  lodgeId: string;
  escrowId?: string;
  phase: "MOVE_IN" | "MOVE_OUT";
  onSaved: () => void;
};

/**
 * ChecklistForm
 * WHAT: An editable checklist that saves to the server.
 * WHY : It must be quick - a student standing in an empty room with a phone in
 *       one hand should finish this in under a minute.
 */
export function ChecklistForm({ lodgeId, escrowId, phase, onSaved }: ChecklistFormProps) {
  const toast = useToast();
  const [items, setItems] = useState<ChecklistItem[]>(
    DEFAULT_ITEMS.map((item) => ({ item, ok: true, note: "" }))
  );
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);

  /** Flips the good/damaged state of one row. */
  const toggle = (index: number) =>
    setItems((current) => current.map((row, i) => (i === index ? { ...row, ok: !row.ok } : row)));

  /** Updates the note on one row. */
  const setNote = (index: number, note: string) =>
    setItems((current) => current.map((row, i) => (i === index ? { ...row, note } : row)));

  /** Adds a custom row the landlord or tenant thought of. */
  const addItem = () => {
    const label = newItem.trim();
    if (!label) return;
    setItems((current) => [...current, { item: label, ok: true, note: "" }]);
    setNewItem("");
  };

  /** Saves the checklist to the server. */
  async function save() {
    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/checklists", "POST", {
      lodgeId,
      escrowId,
      phase,
      items: items.map(({ item, ok, note }) => ({ item, ok, note: note || undefined })),
      photoUrls: [],
      signed,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(phase === "MOVE_IN" ? "Move-in condition saved." : "Move-out condition saved.");
    onSaved();
  }

  // Count how many items are damaged - shown in the header as a warning.
  const damagedCount = items.filter((item) => !item.ok).length;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {phase === "MOVE_IN" ? "Move-in condition" : "Move-out condition"}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Tick what is fine, tap the X for anything damaged. Both parties sign the same record.
          </p>
        </div>
        {damagedCount > 0 ? (
          <span className="shrink-0 rounded-full bg-danger-light px-2.5 py-1 text-[11px] font-bold text-danger-dark">
            {damagedCount} issue{damagedCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {/* The rows */}
      <ul className="mt-4 space-y-2">
        {items.map((row, index) => (
          <li key={`${row.item}-${index}`} className="rounded-xl border border-slate-200 p-2.5">
            <div className="flex items-center gap-2">
              {/* Good / damaged toggle - two big targets side by side. */}
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setItems((current) => current.map((r, i) => (i === index ? { ...r, ok: true } : r)))}
                  aria-label={`${row.item}: good condition`}
                  aria-pressed={row.ok}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    row.ok ? "bg-success-light text-success-dark" : "bg-slate-100 text-slate-400"
                  )}
                >
                  <CheckIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-label={`${row.item}: damaged`}
                  aria-pressed={!row.ok}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    !row.ok ? "bg-danger-light text-danger-dark" : "bg-slate-100 text-slate-400"
                  )}
                >
                  <CloseIcon size={16} />
                </button>
              </div>

              <span className={cn("flex-1 text-sm", row.ok ? "text-slate-800" : "font-semibold text-danger-dark")}>
                {row.item}
              </span>
            </div>

            {/* A note is only really needed for damaged items. */}
            {!row.ok ? (
              <input
                value={row.note}
                onChange={(event) => setNote(index, event.target.value)}
                placeholder="Describe the damage (e.g. crack on the left tile)"
                className="mt-2 min-h-[40px] w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-800 focus:border-primary-400 focus:outline-none"
              />
            ) : null}
          </li>
        ))}
      </ul>

      {/* Add a custom item */}
      <div className="mt-3 flex gap-2">
        <Input
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          placeholder="Add another item to check"
          className="flex-1"
        />
        <Button variant="secondary" onClick={addItem} disabled={!newItem.trim()}>
          Add
        </Button>
      </div>

      {/* Signature confirmation */}
      <label className="mt-4 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
        <input
          type="checkbox"
          checked={signed}
          onChange={(event) => setSigned(event.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-xs leading-relaxed text-slate-700">
          I confirm this record is accurate. It will be timestamped and shared with the other party, and used if there is
          ever a caution deposit dispute.
        </span>
      </label>

      {error ? <p className="mt-2 text-xs font-medium text-danger">{error}</p> : null}

      <Button fullWidth loading={saving} onClick={save} className="mt-3">
        Save {phase === "MOVE_IN" ? "move-in" : "move-out"} record
      </Button>
    </div>
  );
}
