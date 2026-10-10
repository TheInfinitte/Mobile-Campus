/**
 * src/components/housing/LodgeForm.tsx
 * WHAT: The form a landlord fills in to list a lodge, including photo upload.
 * WHY : A listing form is the longest form in the app. Breaking it into clearly
 *       labelled sections (basics, money, utilities, location, photos) makes it
 *       survivable on a phone.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { AMENITIES, ROOM_TYPE_LABELS, WATER_LABELS, METER_LABELS } from "@/lib/data";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { toKobo } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * LodgeForm
 * WHAT: Collects every field the createLodgeSchema expects and posts it.
 * WHY : Money is entered in naira (what a landlord thinks in) and converted to
 *       kobo here, so the API always receives the unit the database stores.
 */
export function LodgeForm() {
  const router = useRouter();
  const toast = useToast();

  // Basics
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const areas = useInstitutionAreas();
  const [area, setArea] = useState<string>("");
  // Auto-select the first community when the institution list arrives.
  useEffect(() => {
    if (!area && areas.length > 0) setArea(areas[0]);
  }, [areas, area]);
  const [address, setAddress] = useState("");

  // Money - held as text so the user can type "45k".
  const [monthlyRent, setMonthlyRent] = useState("");
  const [annualRent, setAnnualRent] = useState("");
  const [cautionDeposit, setCautionDeposit] = useState("");

  // Utilities and layout
  const [roomType, setRoomType] = useState("SINGLE_SELF_CONTAIN");
  const [waterSource, setWaterSource] = useState("BOREHOLE");
  const [meterType, setMeterType] = useState("PREPAID");
  const [waterNote, setWaterNote] = useState("");
  const [lightNote, setLightNote] = useState("");

  // Location
  const [distanceToGate, setDistanceToGate] = useState("");

  // Occupancy and contact
  const [availableRooms, setAvailableRooms] = useState("1");
  const [maxOccupancy, setMaxOccupancy] = useState("1");
  const [caretakerName, setCaretakerName] = useState("");
  const [caretakerPhone, setCaretakerPhone] = useState("");

  // Media and amenities
  const [images, setImages] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Toggles an amenity chip on or off. */
  function toggleAmenity(amenity: string) {
    setAmenities((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity]
    );
  }

  /** Validates locally first, so obvious mistakes never hit the network. */
  function validate(): string {
    if (title.trim().length < 5) return "Give the listing a clear title.";
    if (description.trim().length < 20) return "Describe the lodge in at least a sentence.";
    if (address.trim().length < 5) return "Enter the street address.";
    if (!monthlyRent) return "Enter the monthly rent.";
    if (images.length === 0) return "Add at least one photo - listings without photos are ignored.";
    return "";
  }

  /** Sends the listing to the API. */
  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }

    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/housing", "POST", {
      title: title.trim(),
      description: description.trim(),
      area,
      address: address.trim(),
      // naira -> kobo conversion happens here.
      monthlyRentKobo: toKobo(Number(monthlyRent.replace(/[^\d.]/g, ""))),
      annualRentKobo: annualRent ? toKobo(Number(annualRent.replace(/[^\d.]/g, ""))) : 0,
      cautionDepositKobo: cautionDeposit ? toKobo(Number(cautionDeposit.replace(/[^\d.]/g, ""))) : 0,
      roomType,
      waterSource,
      meterType,
      waterNote: waterNote || undefined,
      lightNote: lightNote || undefined,
      distanceToMainGateMeters: distanceToGate ? Number(distanceToGate) : undefined,
      amenities,
      availableRooms: Number(availableRooms) || 1,
      maxOccupancy: Number(maxOccupancy) || 1,
      caretakerName: caretakerName || undefined,
      caretakerPhone: caretakerPhone || undefined,
      images,
    });

    setSaving(false);

    if (!result.ok || !result.data) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Your listing is live.");
    router.push(`/housing/${result.data.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* ---------------------------------------------------------------- */}
      {/* BASICS                                                            */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader title="About the lodge" subtitle="This is what students read first" />
        <div className="mt-3 space-y-3">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Clean single self-contain with borehole" required />
          <TextArea
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="Describe the room, the compound, the water situation and what is included in the rent."
            required
          />
          <Select
            label="Area"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            options={areas.map((option) => ({ value: option, label: option }))}
          />
          <Input label="Street address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="12 Ekrejeta Road, opposite the filling station" required />
        </div>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* MONEY                                                             */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Price" subtitle="Enter amounts in Naira" />
        <div className="mt-3 space-y-3">
          <Input label="Monthly rent (₦)" value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} inputMode="numeric" placeholder="45000" required />
          <Input label="Annual rent (₦)" value={annualRent} onChange={(event) => setAnnualRent(event.target.value)} inputMode="numeric" placeholder="480000" hint="Leave blank to use 11 months" />
          <Input label="Caution deposit (₦)" value={cautionDeposit} onChange={(event) => setCautionDeposit(event.target.value)} inputMode="numeric" placeholder="50000" hint="Refundable - state your conditions clearly" />
        </div>
        <p className="mt-3 rounded-xl bg-primary-50 p-3 text-[11px] leading-relaxed text-primary-900">
          Mobile Campus charges 1% of the booking to you and 1% to the tenant. Both sides see the full breakdown before anyone
          pays.
        </p>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* UTILITIES                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Water, light and room type" subtitle="The three questions every student asks" />
        <div className="mt-3 space-y-3">
          <Select
            label="Room type"
            value={roomType}
            onChange={(event) => setRoomType(event.target.value)}
            options={Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Water source"
            value={waterSource}
            onChange={(event) => setWaterSource(event.target.value)}
            options={Object.entries(WATER_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input label="Water note" value={waterNote} onChange={(event) => setWaterNote(event.target.value)} placeholder="Borehole runs 24/7, free for tenants" />
          <Select
            label="Electricity"
            value={meterType}
            onChange={(event) => setMeterType(event.target.value)}
            options={Object.entries(METER_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input label="Light note" value={lightNote} onChange={(event) => setLightNote(event.target.value)} placeholder="Prepaid meter per room, expect ₦4,000 a month" />
        </div>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* LOCATION AND OCCUPANCY                                            */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Location and rooms" />
        <div className="mt-3 space-y-3">
          <Input
            label="Distance to the campus main gate (metres)"
            value={distanceToGate}
            onChange={(event) => setDistanceToGate(event.target.value)}
            inputMode="numeric"
            placeholder="450"
            hint="Roughly. We turn this into a walking time for students."
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Rooms available" value={availableRooms} onChange={(event) => setAvailableRooms(event.target.value)} inputMode="numeric" />
            <Input label="People per room" value={maxOccupancy} onChange={(event) => setMaxOccupancy(event.target.value)} inputMode="numeric" />
          </div>
          <Input label="Caretaker name" value={caretakerName} onChange={(event) => setCaretakerName(event.target.value)} placeholder="Mrs. Sunny Ogboru" />
          <Input label="Caretaker phone" value={caretakerPhone} onChange={(event) => setCaretakerPhone(event.target.value)} inputMode="tel" placeholder="08030000010" />
        </div>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* AMENITIES                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Amenities" subtitle="Tap everything that applies" />
        <div className="mt-3 flex flex-wrap gap-2">
          {AMENITIES.map((amenity) => (
            <button
              key={amenity}
              type="button"
              onClick={() => toggleAmenity(amenity)}
              aria-pressed={amenities.includes(amenity)}
              className={cn(
                "min-h-[36px] rounded-full border px-3.5 text-xs font-semibold transition-colors",
                amenities.includes(amenity)
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              )}
            >
              {amenity}
            </button>
          ))}
        </div>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* PHOTOS                                                            */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader title="Photos" subtitle="The first photo becomes the cover" />
        <div className="mt-3">
          <ImageUploader onChange={setImages} maxImages={8} folder="lodges" label="Lodge photos" />
        </div>
      </Card>

      {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}

      <Button type="submit" fullWidth loading={saving}>
        Publish listing
      </Button>
    </form>
  );
}
