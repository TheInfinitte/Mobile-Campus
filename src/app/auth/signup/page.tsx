/**
 * src/app/auth/signup/page.tsx
 * WHAT: Step 1 of sign-up - choose your institution, choose a role, give a name,
 *       phone number and password, and accept the NDPA data protection terms.
 *       Landlords additionally choose DIRECT (owner) or AGENT (representing an
 *       offline owner) and provide the owner's details when acting as agent.
 * WHY : The consent tick is not a formality. The platform stores matric numbers,
 *       JAMB numbers and ID images, so explicit consent is collected before any of
 *       that is captured. The API rejects the request without it.
 *
 * MULTI-CAMPUS: the institution list comes from the database, so adding a campus
 * never needs a code change. Every account is siloed to the chosen school.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Checkbox, Segmented } from "@/components/ui/Input";
import { InstitutionPicker } from "@/components/shared/InstitutionPicker";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { BedIcon, HomeIcon, LockIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";


/**
 * SignupPage
 * WHAT: Gathers the account details and sends the first SMS code.
 * WHY : Role is chosen first because it changes everything the user will see -
 *       a student gets housing and roommates, a landlord gets listing tools.
 */
export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const toast = useToast();

  // The school list comes from the API (database-driven, multi-campus).

  const [role, setRole] = useState<"STUDENT" | "LANDLORD">("STUDENT");
  const [institutionId, setInstitutionId] = useState("");
  const [landlordType, setLandlordType] = useState<"DIRECT" | "AGENT">("DIRECT");
  const [principalName, setPrincipalName] = useState("");
  const [principalPhone, setPrincipalPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /** Client-side checks before we spend an API call. */
  function validate(): string {
    if (!institutionId) return "Please choose your institution.";
    if (fullName.trim().length < 3) return "Please enter your full name.";
    if (phone.replace(/\D/g, "").length < 10) return "Please enter a valid Nigerian phone number.";
    if (password.length < 8) return "Your password needs at least 8 characters.";
    if (password !== confirm) return "The two passwords do not match.";
    if (role === "LANDLORD" && landlordType === "AGENT") {
      if (principalName.trim().length < 3) return "As an agent, add the property owner's full name.";
      if (principalPhone.replace(/\D/g, "").length < 10) return "As an agent, add the property owner's phone number.";
    }
    if (!consent) return "Please accept the data protection terms to continue.";
    return "";
  }

  /** Starts sign-up, then hands over to the code screen. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    setError("");

    const result = await sendApi<{ phone: string; devCode?: string }>("/api/auth/signup", "POST", {
      phone,
      fullName: fullName.trim(),
      password,
      role,
      institutionId,
      landlordType,
      principalName: role === "LANDLORD" && landlordType === "AGENT" ? principalName.trim() : undefined,
      principalPhone: role === "LANDLORD" && landlordType === "AGENT" ? principalPhone.trim() : undefined,
      consent: true,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    // Carry the phone number to the next step so the user does not retype it.
    router.push(`/auth/verify?phone=${encodeURIComponent(result.data?.phone ?? phone)}&next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">It takes about a minute.</p>

      {/* ------------------------------------------------------------ */}
      {/* ROLE CHOICE                                                    */}
      {/* ------------------------------------------------------------ */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { value: "STUDENT" as const, label: "Student", note: "Find a room, a roommate, buy and sell", icon: <BedIcon size={18} /> },
          { value: "LANDLORD" as const, label: "Landlord", note: "List rooms and manage tenants", icon: <HomeIcon size={18} /> },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRole(option.value)}
            aria-pressed={role === option.value}
            className={cn(
              "rounded-2xl border p-3.5 text-left transition-colors",
              role === option.value ? "border-primary-600 bg-primary-50" : "border-slate-200 bg-white"
            )}
          >
            <span className={cn("inline-flex", role === option.value ? "text-primary-600" : "text-slate-400")}>{option.icon}</span>
            <p className="mt-1.5 text-sm font-bold text-slate-900">{option.label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{option.note}</p>
          </button>
        ))}
      </div>

      <Card className="mt-4">
        <form onSubmit={submit} className="space-y-3.5">
          {/* -------------------------------------------------------- */}
          {/* INSTITUTION - the multi-campus silo choice                 */}
          {/* -------------------------------------------------------- */}
          {/* SEARCHABLE ONBOARDING: type-to-filter autocomplete instead of a
              long scrolling dropdown. The picker fetches the school list
              itself and filters live in the browser. */}
          <InstitutionPicker value={institutionId} onChange={setInstitutionId} />

          {/* -------------------------------------------------------- */}
          {/* LANDLORD MODE - direct owner or agent for an owner         */}
          {/* -------------------------------------------------------- */}
          {role === "LANDLORD" ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Segmented
                ariaLabel="How do you list properties?"
                value={landlordType}
                onChange={setLandlordType}
                options={[
                  { value: "DIRECT", label: "I am the owner" },
                  { value: "AGENT", label: "Agent / student rep" },
                ]}
              />
              {landlordType === "AGENT" ? (
                <>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    You are listing on behalf of an owner who is offline. Their name is shown on your listings so
                    students always know who the real owner is.
                  </p>
                  <Input label="Owner's full name" value={principalName} onChange={(event) => setPrincipalName(event.target.value)} placeholder="Chief Daniel Erhire" />
                  <Input label="Owner's phone" value={principalPhone} onChange={(event) => setPrincipalPhone(event.target.value)} inputMode="tel" placeholder="0803 000 0021" />
                </>
              ) : null}
            </div>
          ) : null}

          <Input label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Chidera Okafor" autoComplete="name" required />
          <Input
            label="Phone number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="0803 000 0001"
            hint="We send a 6-digit code to confirm this number."
            autoComplete="tel"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
          <Input label="Confirm password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required />

          {/* -------------------------------------------------------- */}
          {/* NDPA CONSENT                                               */}
          {/* -------------------------------------------------------- */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Checkbox
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              label="I agree to how my data is handled"
              description="Under the Nigeria Data Protection Act, we need your permission to store the details you give us. Your matric number, JAMB number and ID image are encrypted in our database, are never shown to other users, and are only used to confirm you are a real student of your institution. You can ask us to delete your account at any time."
            />
          </div>

          {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

          <Button type="submit" fullWidth loading={loading}>
            Send me a code
          </Button>
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <LockIcon size={13} />
          Your password is hashed. Nobody at Mobile Campus can read it.
        </p>

        <p className="mt-3 text-center text-xs text-slate-600">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-bold text-primary-700">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
