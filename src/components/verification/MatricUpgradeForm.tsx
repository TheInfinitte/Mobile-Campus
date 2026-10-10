/**
 * src/components/verification/MatricUpgradeForm.tsx
 * WHAT: The JAMB -> matric upgrade form for freshers whose number arrived.
 * WHY : The transition must be smooth: one small card on the verification page,
 *       one admin check, and the account quietly becomes fully VERIFIED with
 *       the encrypted matric number stored.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { sendApi } from "@/lib/api-client";
import { CapIcon } from "@/components/ui/Icons";

/**
 * MatricUpgradeForm
 * WHAT: Collects the new matric number + a fresh ID card photo.
 */
export function MatricUpgradeForm() {
  const toast = useToast();
  const [matricNumber, setMatricNumber] = useState("");
  const [idCardUrls, setIdCardUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (matricNumber.trim().length < 4) {
      setError("Enter your matric number exactly as issued.");
      return;
    }
    if (idCardUrls.length === 0) {
      setError("Upload a clear photo of your student ID card.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await sendApi<{ id: string }>("/api/verifications/upgrade-matric", "POST", {
      matricNumber: matricNumber.trim(),
      idCardUrl: idCardUrls[0],
      consent: true,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not submit the upgrade.");
      return;
    }
    toast.success("Matric upgrade submitted - we will review it shortly.");
    setMatricNumber("");
    setIdCardUrls([]);
  }

  return (
    <Card className="border border-primary-200 bg-primary-50/60">
      <CardHeader
        title="Got your matric number now?"
        subtitle="Upgrade from JAMB to matric and become fully verified. An admin re-checks your ID card once."
      />
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Input
          label="Matric number"
          value={matricNumber}
          onChange={(event) => setMatricNumber(event.target.value)}
          placeholder="e.g. DELSU/2025/01234"
        />
        <ImageUploader label="Photo of your student ID card" maxImages={1} folder="student-id" onChange={setIdCardUrls} />
        {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}
        <Button type="submit" loading={saving}>
          <CapIcon size={16} /> Submit matric upgrade
        </Button>
      </form>
    </Card>
  );
}
