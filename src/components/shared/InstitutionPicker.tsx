/**
 * src/components/shared/InstitutionPicker.tsx
 * WHAT: A searchable autocomplete input for choosing a school at sign-up.
 * WHY : Nigeria has hundreds of schools - scrolling a long <select> on a phone
 *       is painful. Typing two letters ("del", "unib", "abraka") should land
 *       the student on their school instantly.
 *
 * HOW IT FILTERS: the full institution list is fetched once from
 * /api/institutions, then filtered live in the browser as the user types -
 * zero network round-trips per keystroke, so filtering feels instant even on
 * a slow connection.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFetch } from "@/hooks/useFetch";
import { SearchIcon, CheckIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

/** One row of the institution list. */
type InstitutionOption = {
  id: string;
  name: string;
  shortName: string;
  type: string;
  city: string;
  state: string;
  // Extra searchable words: abbreviations, old names, city nicknames.
  searchAliases?: string[];
};

type InstitutionPickerProps = {
  /** The id of the institution currently chosen ("" = none yet). */
  value: string;
  /** Called with the chosen id, or "" when the choice is cleared. */
  onChange: (institutionId: string) => void;
  label?: string;
  error?: string;
};

/**
 * InstitutionPicker
 * WHAT: Text input + filtered dropdown. Keyboard and touch both work.
 * WHY : A plain input with a results list underneath keeps the tap targets at
 *       44px+ and needs no dropdown library.
 */
export function InstitutionPicker({ value, onChange, label = "Your institution", error }: InstitutionPickerProps) {
  const { data, loading } = useFetch<{ institutions: InstitutionOption[] }>("/api/institutions");
  const institutions = data?.institutions ?? [];

  // What the user is typing right now.
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Which result the arrow keys are highlighting (-1 = none).
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // The chosen school, so we can show its name in the closed input.
  const selected = institutions.find((institution) => institution.id === value) ?? null;
  // The input shows the query while typing, otherwise the chosen school.
  const displayValue = open ? query : selected ? `${selected.name} (${selected.shortName})` : query;

  /**
   * The filtered list.
   * Matches name, short name, city, state and searchAliases - so typing
   * "abraka" or "delta state" or "delsu" all find DELSU.
   */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return institutions; // Empty box = show everything, sorted A-Z.
    return institutions.filter((institution) => {
      const haystack = [institution.name, institution.shortName, institution.city, institution.state, ...(institution.searchAliases ?? [])]
        .join(" ")
        .toLowerCase();
      // Every typed word must appear somewhere, e.g. "delta university".
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [query, institutions]);

  // Close the dropdown when the user taps anywhere outside of it.
  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  /** Picks a school and closes the list. */
  function choose(institution: InstitutionOption) {
    onChange(institution.id);
    setQuery("");
    setOpen(false);
    setHighlight(-1);
  }

  /** Arrow keys move the highlight; Enter picks; Escape closes. */
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      // Enter picks the highlighted row, or the only match - but never
      // submits the whole sign-up form by accident.
      if (matches.length > 0) {
        event.preventDefault();
        choose(matches[highlight >= 0 ? highlight : 0]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="institution-picker">
        {label}
      </label>

      <div className="relative">
        <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="institution-picker"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="institution-picker-list"
          aria-autocomplete="list"
          autoComplete="off"
          className={cn(
            "min-h-11 w-full rounded-xl border bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400",
            error ? "border-danger" : "border-slate-200 focus:border-primary-600"
          )}
          placeholder={loading ? "Loading schools..." : "Type your school, e.g. DELSU or Abraka"}
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlight(-1);
            // Typing clears the previous choice - you must pick from the list.
            if (value) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {/* Tick shows a school is actually chosen. */}
        {selected && !open ? (
          <CheckIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-success" />
        ) : null}
      </div>

      {/* The live-filtered results list. */}
      {open ? (
        <ul
          id="institution-picker-list"
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-xs text-slate-500">
              No school matches &ldquo;{query}&rdquo;. Try the short name (e.g. DELSU) or your city.
            </li>
          ) : (
            matches.map((institution, index) => (
              <li key={institution.id} role="option" aria-selected={institution.id === value}>
                <button
                  type="button"
                  // onMouseDown (not onClick) so the pick registers before the
                  // input's blur closes the list.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(institution);
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors",
                    index === highlight ? "bg-primary-50" : "bg-white"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{institution.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {institution.shortName} &middot; {institution.city}, {institution.state} &middot;{" "}
                      {institution.type.toLowerCase()}
                    </span>
                  </span>
                  {institution.id === value ? <CheckIcon size={16} className="shrink-0 text-success" /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {error ? <p className="mt-1.5 text-xs font-semibold text-danger-dark">{error}</p> : null}
    </div>
  );
}
