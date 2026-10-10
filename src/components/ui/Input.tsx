/**
 * src/components/ui/Input.tsx
 * WHAT: Form fields - text input, select, textarea, checkbox, a segmented control
 *       and a money input that understands "150k".
 * WHY : Every form in the app (sign-up, verification, listing an item, posting a
 *       gig) needs the same field styling, the same error display and the same
 *       44px touch target. Defining them once prevents twenty slightly different
 *       inputs.
 */
"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Props shared by every field: a label, an error message and a hint. */
type FieldShellProps = {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
};

/**
 * FieldShell
 * WHAT: The label + control + error + hint wrapper.
 * WHY : Keeps the vertical rhythm of forms identical and wires the label to the
 *       control with htmlFor/id so screen readers announce it correctly.
 */
function FieldShell({
  label,
  error,
  hint,
  required,
  className,
  children,
  id,
}: FieldShellProps & { children: React.ReactNode; id: string }) {
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {/* Errors are shown in red with role="alert" so screen readers announce them. */}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & FieldShellProps;

/**
 * Input
 * WHAT: A standard text/number/email/tel field.
 * WHY : `inputMode="numeric"` opens the number keypad on phones, and a 16px
 *       font stops iOS from zooming the page when focused.
 */
export function Input({ label, error, hint, required, className, id, ...rest }: InputProps) {
  // useId generates a unique, stable id so the label and input always match,
  // even when the same field appears twice on a page.
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className} id={fieldId}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-[44px] w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2",
          error
            ? "border-danger focus:border-danger focus:ring-danger/20"
            : "border-slate-200 focus:border-primary-400 focus:ring-primary-100"
        )}
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldShellProps;

/**
 * TextArea
 * WHAT: A multi-line field for descriptions and messages.
 * WHY : Listings and dispute reports need several lines; a single-line input
 *       would be unusable.
 */
export function TextArea({ label, error, hint, required, className, id, rows = 4, ...rest }: TextAreaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className} id={fieldId}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2",
          error
            ? "border-danger focus:border-danger focus:ring-danger/20"
            : "border-slate-200 focus:border-primary-400 focus:ring-primary-100"
        )}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> &
  FieldShellProps & { options: { value: string; label: string }[] };

/**
 * Select
 * WHAT: A dropdown built from an options array.
 * WHY : Native selects open the phone's own picker, which is faster and more
 *       familiar than a custom dropdown - and it costs no extra JavaScript.
 */
export function Select({ label, error, hint, required, className, id, options, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className} id={fieldId}>
      <div className="relative">
        <select
          id={fieldId}
          className={cn(
            "min-h-[44px] w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900",
            "focus:outline-none focus:ring-2",
            error
              ? "border-danger focus:ring-danger/20"
              : "border-slate-200 focus:border-primary-400 focus:ring-primary-100"
          )}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* A custom chevron so the control looks the same in every browser. */}
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </FieldShell>
  );
}

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  description?: string;
};

/**
 * Checkbox
 * WHAT: A tick box with a full-width clickable label.
 * WHY : The whole row must be tappable on a phone - a 16px box alone is far too
 *       small to hit accurately.
 */
export function Checkbox({ label, description, className, id, ...rest }: CheckboxProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <label
      htmlFor={fieldId}
      className={cn(
        "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3",
        className
      )}
    >
      <input
        id={fieldId}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        {...rest}
      />
      <span className="text-sm leading-snug text-slate-800">
        {label}
        {description ? <span className="mt-0.5 block text-xs text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}

/**
 * Segmented
 * WHAT: A row of mutually exclusive choices that looks like tabs.
 * WHY : On a phone, a segmented control is much faster to use than a dropdown
 *       for two or three options (for example "Monthly / Yearly").
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex w-full rounded-xl bg-slate-100 p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[36px] flex-1 rounded-lg px-3 text-xs font-semibold transition-colors",
              active ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * MoneyInput
 * WHAT: A money field that accepts "150000", "150k" or "₦150,000".
 * WHY : Students type money in shorthand. The hint line reminds them what the
 *       value means before they submit.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = "e.g. 150k",
  className,
}: {
  label?: string;
  value: string;
  onChange: (raw: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode="decimal"
      error={error}
      hint={hint ?? "You can type 150k instead of 150000"}
      className={className}
    />
  );
}
