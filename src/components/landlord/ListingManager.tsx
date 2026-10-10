/**
 * src/components/landlord/ListingManager.tsx
 * WHAT: Lets a landlord change the rent, availability and contact details on a
 *       live listing, pause it, or remove it.
 * WHY : The most common real-world action is "the room has been taken, hide it".
 *       That is one tap here, and it takes effect immediately.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, TextArea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Celebration } from "@/components/ui/Celebration";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { TrashIcon, CheckIcon, CloseIcon } from "@/components/ui/Icons";
import { toKobo, formatNaira } from "@/lib/money";

/** The editable slice of a listing. */
export type ListingManagerData = {
  id: string;
  title: string;
  description: string;
  monthlyRentKobo: number;
  annualRentKobo: number;
  cautionDepositKobo: number;
  availableRooms: number;
  waterNote: string | null;
  lightNote: string | null;
  caretakerName: string | null;
  caretakerPhone: string | null;
  status: string;
};

/**
 * ListingManager
 * WHAT: Sends partial updates to PATCH /api/housing/:id.
 * WHY : Only the changed fields are sent, so a rent increase cannot accidentally
 *       wipe the description.
 */
export function ListingManager({ listing }: { listing: ListingManagerData }) {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [monthlyRent, setMonthlyRent] = useState(String(listing.monthlyRentKobo / 100));
  const [caution, setCaution] = useState(String(listing.cautionDepositKobo / 100));
  const [availableRooms, setAvailableRooms] = useState(String(listing.availableRooms));
  const [waterNote, setWaterNote] = useState(listing.waterNote ?? "");
  const [lightNote, setLightNote] = useState(listing.lightNote ?? "");
  const [caretakerName, setCaretakerName] = useState(listing.caretakerName ?? "");
  const [caretakerPhone, setCaretakerPhone] = useState(listing.caretakerPhone ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isActive = listing.status === "ACTIVE";
  const rentKobo = toKobo(Number(monthlyRent.replace(/[^\d.]/g, "")) || 0);
  const cautionKobo = toKobo(Number(caution.replace(/[^\d.]/g, "")) || 0);

  /** Builds the annual rent from the monthly figure.
   *  WHY : Landlords think in months. We derive the year as 12 months plus the
   *  one-month agreement fee most DELSU landlords charge, and let them see it. */
  const annualKobo = rentKobo * 12;

  /** Sends whatever the user changed. */
  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (rentKobo <= 0) {
      setError("Enter the monthly rent.");
      return;
    }

    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>(`/api/housing/${listing.id}`, "PATCH", {
      title: title.trim(),
      description: description.trim(),
      monthlyRentKobo: rentKobo,
      annualRentKobo: annualKobo,
      cautionDepositKobo: cautionKobo,
      availableRooms: Math.max(1, Number(availableRooms.replace(/\D/g, "")) || 1),
      waterNote: waterNote.trim() || undefined,
      lightNote: lightNote.trim() || undefined,
      caretakerName: caretakerName.trim() || undefined,
      caretakerPhone: caretakerPhone.trim() || undefined,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    setSaved(true);
    toast.success("Listing updated.");
    router.refresh();
  }

  /** Hides the listing from search without deleting it. */
  async function toggleStatus() {
    setBusy(true);
    const result = await sendApi<{ id: string; status: string }>(`/api/housing/${listing.id}`, "PATCH", {
      status: isActive ? "INACTIVE" : "ACTIVE",
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      setConfirmPause(false);
      return;
    }

    setConfirmPause(false);
    toast.success(isActive ? "Hidden from search. You can bring it back any time." : "Live again.");
    router.refresh();
  }

  /** Soft-deletes the listing. */
  async function remove() {
    setBusy(true);
    const result = await sendApi<{ id: string }>(`/api/housing/${listing.id}`, "DELETE");
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      setConfirmRemove(false);
      return;
    }

    toast.success("Listing removed.");
    router.push("/landlord");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={save} className="space-y-4">
        <Card>
          <CardHeader title="Rent and availability" subtitle="Changes appear on your listing immediately" />

          <div className="mt-3 space-y-3">
            <Input
              label="Monthly rent (₦)"
              value={monthlyRent}
              onChange={(event) => setMonthlyRent(event.target.value)}
              inputMode="numeric"
              hint={rentKobo > 0 ? `Students pay 12 months up front: ${formatNaira(annualKobo)}` : undefined}
              required
            />
            <Input label="Caution deposit (₦)" value={caution} onChange={(event) => setCaution(event.target.value)} inputMode="numeric" hint="Refundable. Set it to 0 if you do not charge one." />
            <Input label="Rooms available" value={availableRooms} onChange={(event) => setAvailableRooms(event.target.value)} inputMode="numeric" hint="Set this to 1 when only one is left, and hide the listing when the last one goes." />
          </div>
        </Card>

        <Card>
          <CardHeader title="Listing details" />
          <div className="mt-3 space-y-3">
            <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <TextArea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required />
            <Input label="Water note" value={waterNote} onChange={(event) => setWaterNote(event.target.value)} placeholder="e.g. Borehole is free, tank is cleaned every week" />
            <Input label="Light note" value={lightNote} onChange={(event) => setLightNote(event.target.value)} placeholder="e.g. Prepaid meter, you buy your own units" />
            <Input label="Caretaker name" value={caretakerName} onChange={(event) => setCaretakerName(event.target.value)} />
            <Input label="Caretaker phone" value={caretakerPhone} onChange={(event) => setCaretakerPhone(event.target.value)} inputMode="tel" hint="Shown publicly on the listing, so students can reach someone on site." />
          </div>
        </Card>

        {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

        <Button type="submit" fullWidth loading={saving}>
          <CheckIcon size={16} />
          Save changes
        </Button>
      </form>

      {/* ------------------------------------------------------------ */}
      {/* VISIBILITY CONTROLS                                            */}
      {/* ------------------------------------------------------------ */}
      <Card className="mt-4">
        <CardHeader
          title={isActive ? "Currently live" : "Currently hidden"}
          subtitle={isActive ? "Students can find this room in search" : "Only you can see this room"}
        />

        <Button variant="secondary" fullWidth className="mt-3" onClick={() => setConfirmPause(true)}>
          {isActive ? <CloseIcon size={16} /> : <CheckIcon size={16} />}
          {isActive ? "Hide from search" : "Make it live again"}
        </Button>

        <button type="button" onClick={() => setConfirmRemove(true)} className="mc-btn-ghost mt-2 w-full text-danger-dark">
          <TrashIcon size={16} />
          Remove this listing
        </button>
      </Card>

      <ConfirmDialog
        open={confirmPause}
        onClose={() => setConfirmPause(false)}
        onConfirm={toggleStatus}
        loading={busy}
        title={isActive ? "Hide this listing?" : "Make this listing live?"}
        confirmLabel={isActive ? "Hide it" : "Make it live"}
        message={
          isActive
            ? "Students will not find it in search. Anyone who already shortlisted it can still see the page, and any viewing you have confirmed stays in place."
            : "It will appear in search results again with its current rent and photos."
        }
      />

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Remove this listing?"
        confirmLabel="Remove listing"
        message="The room disappears from the platform for good. Reviews and payment history stay in our records, but you cannot bring this listing back - you would have to create a new one."
      />

      <Celebration
        open={saved}
        onClose={() => setSaved(false)}
        variant="check"
        title="Saved"
        message="Your listing now shows the updated details."
      />
    </>
  );
}
