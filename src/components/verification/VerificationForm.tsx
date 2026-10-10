/**
 * src/components/verification/VerificationForm.tsx
 * WHAT: The form for uploading identity proof - matric number and student ID, or
 *       JAMB number and admission letter, or landlord documents.
 * WHY : One form handles all three cases so the fields, the encryption path and
 *       the consent tick are identical everywhere. The type chosen at the top
 *       decides which identifier field appears.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Checkbox } from "@/components/ui/Input";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Celebration } from "@/components/ui/Celebration";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { LockIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

/** Which kind of proof the user is submitting. */
type VerificationType = "STUDENT_ID" | "FRESHER_JAMB" | "LANDLORD_DOC";

/**
 * VerificationForm
 * WHAT: Collects the identifier, the documents and the consent, then submits.
 * WHY : The consent tick is required by the API. We ask for it here, in the same
 *       breath as the upload, so the user understands what they are agreeing to.
 */
export function VerificationForm({ userRole }: { userRole: UserRole }) {
  const router = useRouter();
  const toast = useToast();

  // Landlords only ever submit documents, so the choice is hidden from them.
  const [type, setType] = useState<VerificationType>(userRole === "LANDLORD" ? "LANDLORD_DOC" : "STUDENT_ID");
  const [matricNumber, setMatricNumber] = useState("");
  // The student ID card photo itself - a separate, required upload.
  const [idCardUrls, setIdCardUrls] = useState<string[]>([]);
  const [jambRegNumber, setJambRegNumber] = useState("");
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  /** The three choices, with a plain-English description of each. */
  const options: { value: VerificationType; label: string; hint: string }[] = [
    { value: "STUDENT_ID", label: "Student ID", hint: "I have a matric number" },
    { value: "FRESHER_JAMB", label: "JAMB / admission", hint: "Not yet matriculated" },
    { value: "LANDLORD_DOC", label: "Property documents", hint: "I am a landlord or caretaker" },
  ];

  /** Checks everything locally before spending an API call. */
  function validate(): string {
    if (type === "STUDENT_ID" && matricNumber.trim().length < 4) return "Enter your matric number exactly as it appears on your ID.";
    if (type === "FRESHER_JAMB" && jambRegNumber.trim().length < 4) return "Enter your JAMB registration number, e.g. 2312345AB.";
    if (type !== "LANDLORD_DOC" && idCardUrls.length === 0) return "Upload a clear photo of your student ID card - it is required.";
    if (documentUrls.length === 0) return "Upload at least one clear photo of your document.";
    if (!consent) return "Please allow us to store your document for verification.";
    return "";
  }

  /** Submits the proof. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string; status: string }>("/api/verifications", "POST", {
      type,
      // Only send the identifier that matches the chosen type.
      matricNumber: type === "STUDENT_ID" ? matricNumber.trim() : undefined,
      jambRegNumber: type === "FRESHER_JAMB" ? jambRegNumber.trim() : undefined,
      // The ID card image travels separately so the API can require it.
      idCardUrl: type !== "LANDLORD_DOC" ? idCardUrls[0] : undefined,
      documentUrls,
      consent: true,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    setDone(true);
    toast.success("Submitted. We will review it shortly.");
    // Refresh so the server-rendered history list picks up the new record.
    router.refresh();
  }

  if (done) {
    return (
      <Celebration
        open
        onClose={() => router.refresh()}
        variant="check"
        title="Submitted"
        message="Our team will review your documents, usually within a few hours on a weekday. You will get an SMS either way."
        action={{ label: "Back to profile", onClick: () => router.push("/profile") }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* ------------------------------------------------------------ */}
      {/* TYPE CHOICE                                                    */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <p className="mc-label">What are you submitting?</p>
        <div className="mt-1.5 space-y-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              aria-pressed={type === option.value}
              className={cn(
                "flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3.5 text-left transition-colors",
                type === option.value ? "border-primary-600 bg-primary-50" : "border-slate-200 bg-white"
              )}
            >
              <span>
                <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                <span className="block text-[11px] text-slate-500">{option.hint}</span>
              </span>
              {type === option.value ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary-600" /> : null}
            </button>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* IDENTIFIER                                                     */}
      {/* ------------------------------------------------------------ */}
      {type === "STUDENT_ID" ? (
        <Card>
          <Input
            label="Matric number"
            value={matricNumber}
            onChange={(event) => setMatricNumber(event.target.value)}
            placeholder="e.g. 2012/05/1234"
            hint="Encrypted before it is stored. Never shown to other users."
            required
          />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Type it exactly as printed on your ID card, including the slashes. A mismatch with your uploaded photo is the most
            common reason a submission is sent back.
          </p>
        </Card>
      ) : null}

      {type === "FRESHER_JAMB" ? (
        <Card>
          <Input
            label="JAMB registration number"
            value={jambRegNumber}
            onChange={(event) => setJambRegNumber(event.target.value)}
            placeholder="e.g. 2412345AB"
            hint="Encrypted before it is stored. Never shown to other users."
            required
          />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            A provisional account lets you browse and shortlist now. Once you matriculate, submit your matric number and
            everything unlocks.
          </p>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* DOCUMENTS                                                      */}
      {/* ------------------------------------------------------------ */}
      <Card>
        {/* DUAL-ID RULE: the student ID card is its own required upload. */}
        {type !== "LANDLORD_DOC" ? (
          <div className="mb-4">
            <ImageUploader label="Photo of your student ID card (required)" maxImages={1} folder="student-id" onChange={setIdCardUrls} />
          </div>
        ) : null}
        <ImageUploader
          label={type === "LANDLORD_DOC" ? "Property photo and ownership document" : "Supporting documents (admission letter, portal screenshot)"}
          maxImages={type === "LANDLORD_DOC" ? 6 : 3}
          folder="verification"
          onChange={setDocumentUrls}
        />

        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Take the photo flat, in good light, with all four corners visible. Blurry photos are the number one reason submissions
          are rejected.
        </p>

        {/* Consent - required by law and by the API. */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Checkbox
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            label="I allow Mobile Campus to store these documents"
            description="We keep them only to confirm your identity, encrypted in our database, and we never show them to other users. You can ask us to delete them at any time."
          />
        </div>
      </Card>

      {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

      <Button type="submit" fullWidth loading={saving}>
        Submit for review
      </Button>

      <p className="flex items-start gap-2 px-2 text-center text-[11px] leading-relaxed text-slate-400">
        <LockIcon size={13} className="mt-px shrink-0" />
        Reviewed by a real person, not a bot. Nothing you upload is sent to any AI service.
      </p>
    </form>
  );
}
