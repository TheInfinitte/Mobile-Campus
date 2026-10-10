/**
 * src/app/auth/verify/page.tsx
 * WHAT: Step 2 of sign-up (and passwordless login) - enter the 6-digit SMS code.
 * WHY : Confirms the person actually holds the phone number. This is the single
 *       fact that makes every "verified student" badge on the platform mean
 *       something.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { ShieldIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

/** How many digits the code has. */
const CODE_LENGTH = 6;

/**
 * VerifyPage
 * WHAT: Six single-character inputs that behave like one field.
 * WHY : Six separate boxes are much easier to tap on a phone than one long field,
 *       and they make it obvious when a digit is missing.
 */
export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const phone = searchParams.get("phone") ?? "";
  const next = searchParams.get("next") ?? "/";

  // One state value per box.
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>(undefined);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first box as soon as the screen appears.
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const code = digits.join("");

  /** Sets one digit and moves the cursor forward. */
  function setDigit(index: number, raw: string) {
    // Take only digits, and only the last character if the user pasted a whole code.
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigits((current) => current.map((value, position) => (position === index ? "" : value)));
      return;
    }

    // Pasted a full code? Fill every box at once.
    if (clean.length > 1) {
      const filled = clean.slice(0, CODE_LENGTH).split("");
      setDigits((current) => current.map((value, position) => filled[position] ?? value));
      inputRefs.current[Math.min(filled.length, CODE_LENGTH - 1)]?.focus();
      return;
    }

    setDigits((current) => current.map((value, position) => (position === index ? clean : value)));
    if (index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  /** Handles the backspace key, which should step backwards. */
  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  /** Checks the code and signs the user in. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (code.length !== CODE_LENGTH) {
      setError("Enter all 6 digits.");
      return;
    }

    setLoading(true);
    setError("");

    const result = await sendApi<{ user: { id: string } }>("/api/auth/verify-otp", "POST", { phone, code });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Phone number confirmed");
    router.push(next);
    router.refresh();
  }

  /** Asks for a fresh code. */
  async function resend() {
    setResending(true);
    const result = await sendApi<{ devCode?: string }>("/api/auth/request-otp", "POST", { phone });
    setResending(false);

    if (result.ok) {
      toast.success("We sent another code");
      setDevCode(result.data?.devCode);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white">
        <ShieldIcon size={22} />
      </span>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Check your phone</h1>
      <p className="mt-1 text-sm text-slate-600">
        We sent a 6-digit code to <strong className="text-slate-900">{phone || "your number"}</strong>.
      </p>

      <Card className="mt-5">
        <form onSubmit={submit}>
          <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                value={digit}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={(event) => onKeyDown(index, event)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                aria-label={`Digit ${index + 1}`}
                className={cn(
                  "h-14 w-full min-w-0 rounded-xl border bg-white text-center text-xl font-bold text-slate-900 outline-none transition-colors",
                  digit ? "border-primary-600" : "border-slate-200",
                  "focus:border-primary-600 focus:ring-2 focus:ring-primary-200"
                )}
              />
            ))}
          </div>

          {error ? <p className="mt-3 rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

          <Button type="submit" fullWidth className="mt-4" loading={loading}>
            Verify and continue
          </Button>
        </form>

        <button type="button" onClick={resend} disabled={resending || !phone} className="mc-btn-ghost mt-3 w-full disabled:opacity-50">
          {resending ? "Sending..." : "I did not get a code"}
        </button>
      </Card>

      {/* In development there is no Termii key, so the code is printed instead. */}
      {devCode ? (
        <Card className="mt-4 border border-warn/30 bg-warn-light">
          <p className="text-xs font-bold text-warn-dark">Development mode</p>
          <p className="mt-1 text-xs text-warn-dark/90">
            No SMS was sent. Your code is <strong className="font-mono text-sm">{devCode}</strong>. It also appears in the
            terminal running <code className="rounded bg-white px-1 font-mono text-[10px]">npm run dev</code>.
          </p>
        </Card>
      ) : null}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-500">
        Confirming your number is what lets us protect the platform. It means a landlord knows the person messaging them about a
        room is a real DELSU student, and a buyer knows the seller is too.
      </p>
    </div>
  );
}
