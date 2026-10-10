/**
 * src/components/housing/LodgeDetail.tsx
 * WHAT: The interactive parts of a lodge page: the photo strip, the shortlist
 *       heart, the "Book with escrow" flow with a full fee breakdown, the viewing
 *       request form, WhatsApp and call buttons, reviews and the report button.
 * WHY : This is where a student decides to spend real money. Everything they need
 *       to feel safe - the fee maths, the escrow explanation, the caretaker's
 *       number, other students' reviews - has to be on this one screen.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardHeader, Divider } from "@/components/ui/Card";
import { Input, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SmartImage } from "@/components/ui/SmartImage";
import { Money, MoneyRow, MoneyTotal } from "@/components/ui/Money";
import { FeeBreakdown } from "@/components/escrow/FeeBreakdown";
import { Celebration } from "@/components/ui/Celebration";
import { ReportModal } from "@/components/shared/ReportModal";
import { ReviewCard, ReviewForm } from "./ReviewCard";
import { ChecklistForm } from "./ChecklistForm";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { formatNaira } from "@/lib/money";
import { whatsappLink, telLink, walkTime, distanceLabel } from "@/lib/utils";
import { METER_LABELS, ROOM_TYPE_LABELS, WATER_LABELS } from "@/lib/data";
import {
  AlertIcon,
  BedIcon,
  BoltIcon,
  CheckIcon,
  DropIcon,
  HeartIcon,
  LockIcon,
  PhoneIcon,
  PinIcon,
  StarIcon,
  WhatsAppIcon,
} from "@/components/ui/Icons";

/** Everything the detail page needs, as returned by the API. */
export type LodgeDetailData = {
  id: string;
  title: string;
  description: string;
  area: string;
  address: string;
  monthlyRentKobo: number;
  annualRentKobo: number;
  cautionDepositKobo: number;
  roomType: string;
  waterSource: string;
  waterNote: string | null;
  meterType: string;
  lightNote: string | null;
  distanceToMainGateMeters: number | null;
  distanceToFacultyMeters: number | null;
  amenities: string[];
  availableRooms: number;
  maxOccupancy: number;
  caretakerName: string | null;
  caretakerPhone: string | null;
  isVerified: boolean;
  ratingAverage: number;
  ratingCount: number;
  images: { url: string; altText: string | null }[];
  reviews: {
    id: string;
    rating: number;
    safety: number | null;
    cleanliness: number | null;
    comment: string;
    isVerifiedTenant: boolean;
    createdAt: string;
    author: { fullName: string; level: string | null; avatarUrl: string | null; isVerified: boolean };
  }[];
  landlord: { id: string; fullName: string; phone: string; isVerified: boolean; landlordType?: string; principalName?: string | null };
  feeKobo: number;
  feeLines: { key: string; label: string; amountKobo: number; note?: string }[];
  totalMoveInKobo: number;
};

type LodgeDetailProps = {
  lodge: LodgeDetailData;
  /** Is the signed-in user allowed to pay and message? (provisional accounts are not) */
  canPay: boolean;
  /** The message shown to provisional accounts instead of the pay button. */
  upgradeNote: string;
  initiallyShortlisted: boolean;
  canReview: boolean;
  signedIn: boolean;
};

/**
 * LodgeDetail
 * WHAT: Renders the full listing and every action on it.
 * WHY : Grouping the actions here keeps the server page simple and makes the
 *       client behaviour easy to follow.
 */
export function LodgeDetail({ lodge, canPay, upgradeNote, initiallyShortlisted, canReview, signedIn }: LodgeDetailProps) {
  const router = useRouter();
  const toast = useToast();

  // Which photo is currently shown in the big strip.
  const [photoIndex, setPhotoIndex] = useState(0);
  // Shortlist state, so the heart fills instantly.
  const [shortlisted, setShortlisted] = useState(initiallyShortlisted);
  // Which sheet is open.
  const [sheet, setSheet] = useState<null | "pay" | "viewing" | "checklist">(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // Viewing form fields.
  const [viewDate, setViewDate] = useState("");
  const [viewMessage, setViewMessage] = useState("");
  // Payment period: how many months are being paid.
  const [months, setMonths] = useState(12);

  /** The price for the chosen period, and the fee that goes with it. */
  const pricing = useMemo(() => {
    const rentKobo = months >= 12 ? lodge.annualRentKobo : lodge.monthlyRentKobo * months;
    // The tenant fee is 1% of the rent, with a ₦500 floor (matching the server).
    const feeKobo = Math.max(50_000, Math.round(rentKobo * 0.01));
    return {
      rentKobo,
      feeKobo,
      totalKobo: rentKobo + lodge.cautionDepositKobo + feeKobo,
      payoutKobo: rentKobo + lodge.cautionDepositKobo - feeKobo,
    };
  }, [months, lodge]);

  /** Toggles the shortlist. Allowed even for provisional accounts. */
  async function toggleShortlist() {
    if (!signedIn) {
      router.push("/auth/login");
      return;
    }
    const result = await sendApi<{ shortlisted: boolean }>("/api/shortlist", "POST", { lodgeId: lodge.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setShortlisted(result.data?.shortlisted ?? false);
    toast.success(result.data?.shortlisted ? "Saved to your shortlist." : "Removed from your shortlist.");
  }

  /** Sends the viewing request. */
  async function sendViewing() {
    if (!viewDate) {
      toast.error("Choose a date and time for the viewing.");
      return;
    }
    setBusy(true);
    const result = await sendApi<{ id: string }>("/api/housing/viewings", "POST", {
      lodgeId: lodge.id,
      preferredDate: new Date(viewDate).toISOString(),
      message: viewMessage || undefined,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Viewing request sent. The caretaker will confirm a time.");
    setSheet(null);
    setViewMessage("");
  }

  /** Starts the escrow payment: creates the deal and opens Flutterwave. */
  async function startPayment() {
    setBusy(true);
    const result = await sendApi<{ paymentUrl: string; totalKobo: number }>("/api/payments", "POST", {
      type: "RENT",
      lodgeId: lodge.id,
      months,
    });
    setBusy(false);

    if (!result.ok || !result.data?.paymentUrl) {
      toast.error(result.error || "We could not start the payment.");
      return;
    }

    // The payment was created - celebrate, then send them to Flutterwave.
    setSheet(null);
    setCelebrate(true);
    // A short pause so the celebration is seen before the page navigates away.
    setTimeout(() => {
      window.location.href = result.data!.paymentUrl;
    }, 900);
  }

  const photos = lodge.images.length > 0 ? lodge.images : [{ url: "", altText: lodge.title }];

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* PHOTO STRIP                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative -mx-4 sm:mx-0 sm:rounded-3xl sm:overflow-hidden">
        <SmartImage
          src={photos[photoIndex]?.url}
          alt={photos[photoIndex]?.altText ?? lodge.title}
          width={1200}
          rounded="none"
          wrapperClassName="h-64 w-full sm:h-80"
        />

        {/* Thumbnail dots */}
        {photos.length > 1 ? (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {photos.map((photo, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                onClick={() => setPhotoIndex(index)}
                className={`h-2 rounded-full transition-all ${index === photoIndex ? "w-5 bg-white" : "w-2 bg-white/50"}`}
              />
            ))}
          </div>
        ) : null}

        {/* Shortlist heart, top right. */}
        <div className="absolute right-3 top-3">
          <IconButton
            label={shortlisted ? "Remove from shortlist" : "Save to shortlist"}
            onClick={toggleShortlist}
            icon={<HeartIcon size={20} filled={shortlisted} className={shortlisted ? "text-danger" : "text-slate-700"} />}
            className="bg-white/95 shadow-sm"
          />
        </div>

        {/* Verification badge, top left. */}
        <div className="absolute left-3 top-3">
          {lodge.isVerified ? <VerifiedBadge label="Verified landlord" /> : <Badge tone="danger">Not verified</Badge>}
        </div>
      </div>

      {/* Thumbnail row so every photo is reachable. */}
      {photos.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {photos.map((photo, index) => (
            <button key={index} type="button" onClick={() => setPhotoIndex(index)} className="shrink-0">
              <SmartImage
                src={photo.url}
                alt={`Photo ${index + 1}`}
                width={160}
                rounded="lg"
                wrapperClassName={`h-16 w-20 ${index === photoIndex ? "ring-2 ring-primary-500" : ""}`}
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* HEADING                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight tracking-tight text-slate-900">{lodge.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <PinIcon size={13} />
              {lodge.area} • {lodge.address}
            </p>
          </div>

          {lodge.ratingCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-900 shadow-sm ring-1 ring-slate-200">
              <StarIcon size={12} filled className="text-gold-500" />
              {lodge.ratingAverage.toFixed(1)}
              <span className="font-medium text-slate-500">({lodge.ratingCount})</span>
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Money kobo={lodge.monthlyRentKobo} size="xl" className="text-primary-700" />
          <span className="text-xs text-slate-500">per month</span>
          <span className="text-xs text-slate-400">•</span>
          <Money kobo={lodge.annualRentKobo} size="sm" className="text-slate-600" suffix="/ year" />
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {lodge.availableRooms > 0 ? `${lodge.availableRooms} room${lodge.availableRooms === 1 ? "" : "s"} available` : "Fully booked"}{" "}
          • Up to {lodge.maxOccupancy} {lodge.maxOccupancy === 1 ? "person" : "people"}
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* THE THREE THINGS STUDENTS CHECK FIRST                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <FactTile icon={<DropIcon size={18} />} label="Water" value={WATER_LABELS[lodge.waterSource] ?? lodge.waterSource} note={lodge.waterNote} />
        <FactTile icon={<BoltIcon size={18} />} label="Light" value={METER_LABELS[lodge.meterType] ?? lodge.meterType} note={lodge.lightNote} />
        <FactTile
          icon={<PinIcon size={18} />}
          label="Distance"
          value={walkTime(lodge.distanceToMainGateMeters)}
          note={distanceLabel(lodge.distanceToMainGateMeters)}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* DESCRIPTION + AMENITIES                                           */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-4">
        <CardHeader title="About this lodge" />
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{lodge.description}</p>

        {lodge.amenities.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="primary" icon={<BedIcon size={11} />}>
              {ROOM_TYPE_LABELS[lodge.roomType] ?? lodge.roomType}
            </Badge>
            {lodge.amenities.map((amenity) => (
              <Badge key={amenity} tone="outline" icon={<CheckIcon size={11} />}>
                {amenity}
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* CARETAKER                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-4">
        <CardHeader title="Caretaker" subtitle={lodge.isVerified ? "Identity document checked by our team" : "Not yet verified"} />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{lodge.caretakerName ?? lodge.landlord.fullName}</p>
            <p className="mt-0.5 text-xs text-slate-500">{lodge.caretakerPhone ?? lodge.landlord.phone}</p>
            {lodge.landlord.landlordType === "AGENT" ? (
              <p className="mt-1 rounded-lg bg-gold-50 px-2 py-1 text-[10px] font-bold text-gold-800">
                Managed on behalf of the owner{lodge.landlord.principalName ? `: ${lodge.landlord.principalName}` : ""}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 gap-2">
            {lodge.caretakerPhone ? (
              <>
                <a
                  href={telLink(lodge.caretakerPhone)}
                  aria-label="Call the caretaker"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
                >
                  <PhoneIcon size={18} />
                </a>
                <a
                  href={whatsappLink(
                    lodge.caretakerPhone,
                    `Hello, I saw "${lodge.title}" in ${lodge.area} on Mobile Campus. Is it still available?`
                  )}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Chat on WhatsApp"
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-success px-3.5 text-xs font-bold text-white"
                >
                  <WhatsAppIcon size={16} />
                  WhatsApp
                </a>
              </>
            ) : null}
          </div>
        </div>

        {!canPay ? (
          <p className="mt-3 rounded-xl bg-warn-light p-3 text-[11px] leading-relaxed text-warn-dark">{upgradeNote}</p>
        ) : null}
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* ACTIONS                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setSheet("viewing")} disabled={!signedIn}>
          Request viewing
        </Button>
        <Button onClick={() => setSheet("pay")} disabled={!canPay || lodge.availableRooms <= 0}>
          <LockIcon size={16} />
          Book with escrow
        </Button>
      </div>

      {/* Escrow reassurance under the buttons. */}
      <p className="mt-2 flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-slate-500">
        <LockIcon size={13} className="mt-px shrink-0" />
        Your rent is held safely and only released to the landlord after you have moved in and confirmed the room is as
        described.
      </p>

      {/* ---------------------------------------------------------------- */}
      {/* MOVE-IN CHECKLIST                                                 */}
      {/* ---------------------------------------------------------------- */}
      {signedIn ? (
        <div className="mt-4">
          <Button variant="secondary" fullWidth onClick={() => setSheet("checklist")}>
            Open move-in / move-out condition checklist
          </Button>
          <p className="mt-1.5 px-1 text-[11px] text-slate-500">
            Record the room&apos;s condition on day one and your caution deposit cannot be argued about later.
          </p>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* REVIEWS                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="mt-7">
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">
          Reviews {lodge.ratingCount > 0 ? <span className="text-sm font-medium text-slate-400">({lodge.ratingCount})</span> : null}
        </h2>

        {lodge.reviews.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">No reviews yet. Only verified students who have rented here can write one.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {lodge.reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={{
                  id: review.id,
                  rating: review.rating,
                  safety: review.safety,
                  cleanliness: review.cleanliness,
                  comment: review.comment,
                  isVerifiedTenant: review.isVerifiedTenant,
                  createdAt: review.createdAt,
                  author: review.author,
                }}
              />
            ))}
          </div>
        )}

        {canReview ? (
          <div className="mt-4">
            <ReviewForm lodgeId={lodge.id} onDone={() => router.refresh()} />
          </div>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* REPORT                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="mt-6">
        <Button variant="ghost" fullWidth onClick={() => setReportOpen(true)} className="text-danger">
          <AlertIcon size={16} />
          Report scam or fake listing
        </Button>
        <Divider className="my-4" />
        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          Never pay a landlord outside Mobile Campus. Payments made outside the app are not protected by escrow.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* SHEETS                                                            */}
      {/* ---------------------------------------------------------------- */}

      {/* PAYMENT SHEET - always shows the full fee breakdown first. */}
      <Modal
        open={sheet === "pay"}
        onClose={() => setSheet(null)}
        title="Book with escrow"
        footer={
          <div className="space-y-2">
            <Button fullWidth loading={busy} onClick={startPayment}>
              Pay {formatNaira(pricing.totalKobo)} securely
            </Button>
            <p className="text-center text-[11px] text-slate-500">You will be taken to Flutterwave to complete payment.</p>
          </div>
        }
      >
        <div className="space-y-4 pb-3">
          {/* Choose the payment period. */}
          <div>
            <p className="mc-label">Payment period</p>
            <div className="grid grid-cols-3 gap-2">
              {[3, 6, 12].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMonths(option)}
                  className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-colors ${
                    months === option ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {option} month{option === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          </div>

          {/* The full breakdown - this is a hard product requirement. */}
          <FeeBreakdown
            itemLabel={`Rent for ${months} month${months === 1 ? "" : "s"}`}
            itemKobo={pricing.rentKobo}
            cautionKobo={lodge.cautionDepositKobo}
            feeLines={[{ key: "HOUSING_TENANT", label: "Mobile Campus fee (tenant)", amountKobo: pricing.feeKobo, note: "1% of the rent" }]}
            totalKobo={pricing.totalKobo}
            payoutKobo={pricing.payoutKobo}
          />

          <MoneyRow label="Shown for transparency" kobo={0} hint="The landlord also pays 1%, deducted from their payout" muted />
          <MoneyTotal label="Total due now" kobo={pricing.totalKobo} />
        </div>
      </Modal>

      {/* VIEWING SHEET */}
      <Modal
        open={sheet === "viewing"}
        onClose={() => setSheet(null)}
        title="Request a viewing"
        footer={
          <Button fullWidth loading={busy} onClick={sendViewing}>
            Send request
          </Button>
        }
      >
        <div className="space-y-4 pb-3">
          <p className="text-xs leading-relaxed text-slate-600">
            Tell {lodge.caretakerName ?? "the caretaker"} when you can come. They will confirm a time and you will get an SMS.
          </p>

          <Input
            label="When can you come?"
            type="datetime-local"
            value={viewDate}
            onChange={(event) => setViewDate(event.target.value)}
            // Never allow a date in the past.
            min={new Date().toISOString().slice(0, 16)}
          />

          <TextArea
            label="Message (optional)"
            value={viewMessage}
            onChange={(event) => setViewMessage(event.target.value)}
            rows={3}
            placeholder="I am a 200L student. Can I come on Saturday morning?"
          />
        </div>
      </Modal>

      {/* CHECKLIST SHEET */}
      <Modal open={sheet === "checklist"} onClose={() => setSheet(null)} title="Room condition record">
        <div className="pb-3">
          <ChecklistForm lodgeId={lodge.id} phase="MOVE_IN" onSaved={() => setSheet(null)} />
        </div>
      </Modal>

      {/* REPORT SHEET */}
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} lodgeId={lodge.id} reportedUserId={lodge.landlord.id} subject={lodge.title} />

      {/* SUCCESS CELEBRATION */}
      <Celebration
        open={celebrate}
        onClose={() => setCelebrate(false)}
        title="Payment started 🎉"
        message="Complete the payment on Flutterwave. Your money will be held safely in escrow."
        variant="confetti"
      />
    </div>
  );
}

/**
 * FactTile
 * WHAT: A small square showing one key fact (water, light, distance).
 * WHY : These three facts decide whether a student keeps reading, so they get
 *       their own visual row.
 */
function FactTile({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note?: string | null }) {
  return (
    <div className="rounded-xl bg-white p-2.5 text-center shadow-card ring-1 ring-slate-100">
      <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">{icon}</span>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-800">{value}</p>
      {note ? <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{note}</p> : null}
    </div>
  );
}
