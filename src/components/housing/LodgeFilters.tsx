/**
 * src/components/housing/LodgeFilters.tsx
 * WHAT: The filter sheet for housing search: price range, area, room type,
 *       water source, electricity type, distance to campus and sort order.
 * WHY : The spec requires search by price, area, water, light, distance and room
 *       type. On a phone a bottom sheet with chips is far faster than a sidebar
 *       full of dropdowns.
 */
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { METER_LABELS, ROOM_TYPE_LABELS, WATER_LABELS } from "@/lib/data";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { parseNairaInput, formatNairaCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/** The filter values this component produces. */
export type LodgeFilterValues = {
  q: string;
  area: string;
  minRent: string; // Kept as the raw text the user typed, e.g. "20k".
  maxRent: string;
  roomType: string;
  water: string;
  meter: string;
  maxDistance: string; // In metres, as a string so the input stays controlled.
  sort: string;
  verifiedOnly: boolean;
};

/** The starting point: no filters at all. */
export const emptyLodgeFilters: LodgeFilterValues = {
  q: "",
  area: "",
  minRent: "",
  maxRent: "",
  roomType: "",
  water: "",
  meter: "",
  maxDistance: "",
  sort: "relevance",
  verifiedOnly: true, // On by default: students should see verified lodges first.
};

/** Quick price presets, because typing "45000" on a phone is annoying. */
const PRICE_PRESETS = [
  { label: "Under ₦25k", max: "25000" },
  { label: "Under ₦40k", max: "40000" },
  { label: "Under ₦60k", max: "60000" },
  { label: "Under ₦100k", max: "100000" },
];

/** Distance presets in metres. */
const DISTANCE_PRESETS = [
  { label: "Under 500m", value: "500" },
  { label: "Under 1km", value: "1000" },
  { label: "Under 2km", value: "2000" },
];

type LodgeFiltersProps = {
  open: boolean;
  onClose: () => void;
  values: LodgeFilterValues;
  onApply: (values: LodgeFilterValues) => void;
  /** How many lodges match the current selection, if the parent knows. */
  resultCount?: number;
};

/**
 * LodgeFilters
 * WHAT: A bottom sheet with every housing filter.
 * WHY : Keeps the listing screen clean while still offering serious filtering
 *       power.
 */
export function LodgeFilters({ open, onClose, values, onApply, resultCount }: LodgeFiltersProps) {
  // MULTI-CAMPUS: area options come from the viewer's institution.
  const areas = useInstitutionAreas();

  // A local draft so "Apply" and "Cancel" behave as the user expects.
  const [draft, setDraft] = useState<LodgeFilterValues>(values);

  /** Updates one field of the draft. */
  const set = <K extends keyof LodgeFilterValues>(key: K, value: LodgeFilterValues[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filter lodges"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setDraft(emptyLodgeFilters)} className="flex-1">
            Clear all
          </Button>
          <Button
            onClick={() => onApply(draft)}
            className="flex-[2]"
          >
            {resultCount !== undefined ? `Show ${resultCount} lodges` : "Apply filters"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-4">
        {/* ---------------- SEARCH TEXT ---------------- */}
        <Input
          label="Search"
          value={draft.q}
          onChange={(event) => set("q", event.target.value)}
          placeholder="e.g. self contain Ekrejeta"
        />

        {/* ---------------- AREA ---------------- */}
        <div>
          <p className="mc-label">Area</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={draft.area === ""} onClick={() => set("area", "")}>
              Anywhere
            </Chip>
            {areas.map((area) => (
              <Chip key={area} active={draft.area === area} onClick={() => set("area", area)}>
                {area}
              </Chip>
            ))}
          </div>
        </div>

        {/* ---------------- PRICE ---------------- */}
        <div>
          <p className="mc-label">Monthly rent</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={draft.minRent}
              onChange={(event) => set("minRent", event.target.value)}
              placeholder="Min (e.g. 20k)"
              inputMode="decimal"
            />
            <Input
              value={draft.maxRent}
              onChange={(event) => set("maxRent", event.target.value)}
              placeholder="Max (e.g. 60k)"
              inputMode="decimal"
            />
          </div>

          {/* Live preview of what the typed values mean. */}
          {draft.minRent || draft.maxRent ? (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Showing{" "}
              {draft.minRent ? `from ${formatNairaCompact(parseNairaInput(draft.minRent))}` : "any price"} to{" "}
              {draft.maxRent ? formatNairaCompact(parseNairaInput(draft.maxRent)) : "any price"}
            </p>
          ) : null}

          <div className="mt-2.5 flex flex-wrap gap-2">
            {PRICE_PRESETS.map((preset) => (
              <Chip key={preset.label} active={draft.maxRent === preset.max} onClick={() => set("maxRent", preset.max)}>
                {preset.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ---------------- ROOM TYPE ---------------- */}
        <Select
          label="Room type"
          value={draft.roomType}
          onChange={(event) => set("roomType", event.target.value)}
          options={[
            { value: "", label: "Any room type" },
            ...Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />

        {/* ---------------- WATER ---------------- */}
        <div>
          <p className="mc-label">Water</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={draft.water === ""} onClick={() => set("water", "")}>
              Any
            </Chip>
            {Object.entries(WATER_LABELS).map(([value, label]) => (
              <Chip key={value} active={draft.water === value} onClick={() => set("water", value)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ---------------- ELECTRICITY ---------------- */}
        <div>
          <p className="mc-label">Electricity</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={draft.meter === ""} onClick={() => set("meter", "")}>
              Any
            </Chip>
            {Object.entries(METER_LABELS).map(([value, label]) => (
              <Chip key={value} active={draft.meter === value} onClick={() => set("meter", value)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ---------------- DISTANCE ---------------- */}
        <div>
          <p className="mc-label">Distance from the campus gate</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={draft.maxDistance === ""} onClick={() => set("maxDistance", "")}>
              Any distance
            </Chip>
            {DISTANCE_PRESETS.map((preset) => (
              <Chip key={preset.value} active={draft.maxDistance === preset.value} onClick={() => set("maxDistance", preset.value)}>
                {preset.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ---------------- SORT ---------------- */}
        <Select
          label="Sort by"
          value={draft.sort}
          onChange={(event) => set("sort", event.target.value)}
          options={[
            { value: "relevance", label: "Best match" },
            { value: "price-asc", label: "Cheapest first" },
            { value: "price-desc", label: "Most expensive first" },
            { value: "rating", label: "Best rated" },
            { value: "distance", label: "Closest to campus" },
          ]}
        />

        {/* ---------------- VERIFIED ONLY ---------------- */}
        <button
          type="button"
          onClick={() => set("verifiedOnly", !draft.verifiedOnly)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left"
          aria-pressed={draft.verifiedOnly}
        >
          <span>
            <span className="block text-sm font-semibold text-slate-900">Verified lodges only</span>
            <span className="block text-[11px] text-slate-500">Landlord documents checked by our team</span>
          </span>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              draft.verifiedOnly ? "bg-primary-600" : "bg-slate-200"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                draft.verifiedOnly ? "left-[22px]" : "left-0.5"
              )}
            />
          </span>
        </button>
      </div>
    </Modal>
  );
}

/**
 * Chip
 * WHAT: A selectable pill used inside the filter sheet.
 * WHY : Chips are the fastest way to pick from a short list on a phone, and they
 *       wrap neatly at 360px width.
 */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-[36px] rounded-full border px-3.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary-600 bg-primary-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      )}
    >
      {children}
    </button>
  );
}
