/**
 * src/components/escrow/EscrowDetailClient.tsx
 * WHAT: The interactive half of the escrow detail page - confirm, release, raise
 *       a dispute, and the WhatsApp link to the other party.
 * WHY : These actions change money, so each one is a deliberate tap with a
 *       confirmation step and a clear explanation of what will happen next.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { MoneyRow, MoneyTotal } from "@/components/ui/Money";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import { Celebration } from "@/components/ui/Celebration";
import { EscrowTracker, EscrowStatePill } from "@/components/escrow/EscrowTracker";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { ShieldIcon, AlertIcon, WhatsAppIcon, PhoneIcon, CheckIcon, ClockIcon } from "@/components/ui/Icons";
import { formatNaira } from "@/lib/money";
import { stateLabel, describeState } from "@/lib/escrow-state";
import { formatDate, whatsappLink, telLink, initials } from "@/lib/utils";
import type { EscrowState, EscrowType } from "@prisma/client";

/** The shape the server page hands down. */
export type EscrowDetailData = {
  id: string;
  reference: string;
  type: EscrowType;
  state: EscrowState;
  itemAmountKobo: number;
  cautionKobo: number;
  feeKobo: number;
  totalKobo: number;
  payoutKobo: number;
  feeSnapshot: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  subject: string;
  subjectHref: string | null;
  iAmPayer: boolean;
  iAmPayee: boolean;
  otherParty: { fullName: string; phone: string; isVerified: boolean };
  dispute: { id: string; status: string; reason: string; details: string; resolution: string | null; createdAt: string } | null;
  splitShares: { id: string; fullName: string; amountKobo: number; isPaid: boolean }[];
  caretaker: { name: string | null; phone: string | null } | null;
};

/**
 * EscrowDetailClient
 * WHAT: Renders the tracker, the money, the action buttons and the dispute form.
 */
export function EscrowDetailClient({ escrow }: { escrow: EscrowDetailData }) {
  const router = useRouter();
  const toast = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDetails, setDisputeDetails] = useState("");
  const [busy, setBusy] = useState(false);

  // Which state we are in drives which buttons appear.
  const canConfirm = escrow.iAmPayer && escrow.state === "HELD";
  const canRelease = escrow.iAmPayee && escrow.state === "CONFIRMED";
  const canDispute = (escrow.iAmPayer || escrow.iAmPayee) && (escrow.state === "HELD" || escrow.state === "CONFIRMED") && !escrow.dispute;

  /** The buyer confirms they received what they paid for. */
  async function confirm() {
    setBusy(true);
    const result = await sendApi<{ state: string }>(`/api/escrow/${escrow.id}/confirm`, "POST", {});
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setConfirmOpen(false);
    setCelebrate(true);
    toast.success("Confirmed. The money will be released shortly.");
    router.refresh();
  }

  /** The seller triggers the payout to their own bank account. */
  async function release() {
    setBusy(true);
    const result = await sendApi<{ state: string; payoutKobo: number }>(`/api/escrow/${escrow.id}/release`, "POST", {});
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setReleaseOpen(false);
    setCelebrate(true);
    toast.success(`${formatNaira(result.data?.payoutKobo ?? escrow.payoutKobo)} is on its way to your bank.`);
    router.refresh();
  }

  /** Opens a dispute, which freezes the money until an admin decides. */
  async function openDispute(event: React.FormEvent) {
    event.preventDefault();

    if (disputeReason.trim().length < 5) {
      toast.error("Give a short reason, e.g. 'Item not delivered'.");
      return;
    }
    if (disputeDetails.trim().length < 20) {
      toast.error("Explain what happened in a little more detail.");
      return;
    }

    setBusy(true);
    const result = await sendApi<{ id: string }>(`/api/disputes`, "POST", {
      escrowId: escrow.id,
      reason: disputeReason.trim(),
      details: disputeDetails.trim(),
      evidenceUrls: [],
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setDisputeOpen(false);
    toast.success("Dispute opened. Our team will review it within 24 hours.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ */}
      {/* STATE                                                          */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900">
              {escrow.subjectHref ? (
                <Link href={escrow.subjectHref} className="underline decoration-primary-200 underline-offset-2">
                  {escrow.subject}
                </Link>
              ) : (
                escrow.subject
              )}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {escrow.iAmPayer ? "You paid" : "Paid to you"} · {formatDate(escrow.createdAt)}
            </p>
          </div>
          <EscrowStatePill state={escrow.state} />
        </div>

        <EscrowTracker
          state={escrow.state}
          dates={{
            createdAt: escrow.createdAt,
            confirmedAt: escrow.confirmedAt,
            releasedAt: escrow.releasedAt,
            refundedAt: escrow.refundedAt,
          }}
        />

        {/* Plain-English explanation of what is happening right now. */}
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{describeState(escrow.state, escrow.iAmPayer)}</p>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* THE MONEY                                                      */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader title="What was paid" subtitle="Kept for your records, including the fee rule used at the time" />

        <div className="mt-3 space-y-2">
          <MoneyRow label={escrow.type === "RENT" ? "Rent" : escrow.type === "SERVICE" ? "Task fee" : "Item price"} kobo={escrow.itemAmountKobo} />
          {escrow.cautionKobo > 0 ? <MoneyRow label="Caution deposit (refundable)" kobo={escrow.cautionKobo} /> : null}
          <MoneyRow label="Mobile Campus fee" kobo={escrow.feeKobo} />
          <MoneyTotal label="Total paid" kobo={escrow.totalKobo} />
        </div>

        {escrow.feeSnapshot ? <p className="mt-3 text-[10px] leading-relaxed text-slate-400">Fee rule at the time: {escrow.feeSnapshot}</p> : null}

        {escrow.periodStart && escrow.periodEnd ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Covers {formatDate(escrow.periodStart)} to {formatDate(escrow.periodEnd)}
          </p>
        ) : null}

        {/* What the other side will receive - shown to them, hidden from the payer. */}
        {escrow.iAmPayee ? (
          <div className="mt-3 rounded-xl bg-success-light p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-success-dark">You will receive</p>
            <p className="mt-0.5 text-lg font-bold text-success-dark">{formatNaira(escrow.payoutKobo)}</p>
            <p className="mt-0.5 text-[11px] text-success-dark/80">After our fee. Sent to your Flutterwave-linked bank account.</p>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* GROUP RENT SPLIT                                               */}
      {/* ------------------------------------------------------------ */}
      {escrow.splitShares.length > 0 ? (
        <Card>
          <CardHeader title="Group split" subtitle="Each person pays their own share" />
          <div className="mt-3 space-y-2">
            {escrow.splitShares.map((share) => (
              <div key={share.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{share.fullName}</p>
                  <p className="text-[11px] text-slate-500">{formatNaira(share.amountKobo)}</p>
                </div>
                {share.isPaid ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-success-dark">
                    <CheckIcon size={13} /> Paid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                    <ClockIcon size={13} /> Pending
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            The landlord is paid in full once every share is in. Nobody has to chase anybody - you can all see who has paid.
          </p>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* THE OTHER PERSON                                               */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader title={escrow.iAmPayer ? "Who you paid" : "Who paid you"} />
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
            {initials(escrow.otherParty.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{escrow.otherParty.fullName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              {escrow.otherParty.isVerified ? <VerifiedBadge /> : <Badge tone="slate">Unverified</Badge>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a href={telLink(escrow.otherParty.phone)} aria-label="Call" className="mc-btn-secondary h-10 w-10 p-0">
              <PhoneIcon size={16} />
            </a>
            <a href={whatsappLink(escrow.otherParty.phone, `Hello ${escrow.otherParty.fullName.split(" ")[0]}, this is about payment ${escrow.reference}.`)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="mc-btn-secondary h-10 w-10 border-success/30 p-0 text-success-dark">
              <WhatsAppIcon size={16} />
            </a>
          </div>
        </div>

        {/* The caretaker's number, for rentals, because that is who actually opens the door. */}
        {escrow.caretaker?.phone ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-700">Caretaker: {escrow.caretaker.name ?? "On site"}</p>
            <a href={telLink(escrow.caretaker.phone)} className="mt-1 flex items-center gap-1 text-xs font-bold text-primary-700">
              <PhoneIcon size={13} />
              {escrow.caretaker.phone}
            </a>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* DISPUTE STATUS                                                 */}
      {/* ------------------------------------------------------------ */}
      {escrow.dispute ? (
        <Card className="border-danger/30 bg-danger-light">
          <div className="flex items-start gap-2.5">
            <AlertIcon size={18} className="mt-0.5 shrink-0 text-danger-dark" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-danger-dark">Dispute {escrow.dispute.status.toLowerCase().replace("_", " ")}</p>
              <p className="mt-1 text-xs font-semibold text-danger-dark">{escrow.dispute.reason}</p>
              <p className="mt-1 text-xs leading-relaxed text-danger-dark/90">{escrow.dispute.details}</p>
              {escrow.dispute.resolution ? (
                <p className="mt-2 rounded-lg bg-white p-2.5 text-xs leading-relaxed text-slate-700">
                  <strong>Our decision:</strong> {escrow.dispute.resolution}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-danger-dark/80">
                  Raised {formatDate(escrow.dispute.createdAt)}. The money stays frozen until our team decides. We aim to resolve
                  within 24 hours.
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* ACTIONS                                                        */}
      {/* ------------------------------------------------------------ */}
      {canConfirm ? (
        <Button fullWidth onClick={() => setConfirmOpen(true)}>
          <CheckIcon size={16} />
          I received it - release the money
        </Button>
      ) : null}

      {canRelease ? (
        <Button fullWidth onClick={() => setReleaseOpen(true)}>
          <ShieldIcon size={16} />
          Collect {formatNaira(escrow.payoutKobo)}
        </Button>
      ) : null}

      {canDispute ? (
        <button type="button" onClick={() => setDisputeOpen(true)} className="mc-btn-secondary w-full border-danger/30 text-danger-dark">
          <AlertIcon size={16} />
          Something is wrong - raise a dispute
        </button>
      ) : null}

      <p className="px-2 pb-2 text-center text-[11px] leading-relaxed text-slate-400">
        Never confirm before you have checked the item, the room or the job. Once you confirm, the money leaves escrow and we can
        no longer hold it back.
      </p>

      {/* ------------------------------------------------------------ */}
      {/* DIALOGS                                                        */}
      {/* ------------------------------------------------------------ */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirm}
        confirmLabel="Yes, release the money"
        title="Release this payment?"
        message={`This sends ${formatNaira(escrow.payoutKobo)} to ${escrow.otherParty.fullName}. You cannot undo it, so make sure everything is as described.`}
        loading={busy}
      />

      <ConfirmDialog
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        onConfirm={release}
        confirmLabel="Send to my bank"
        title="Collect your payment"
        message={`${formatNaira(escrow.payoutKobo)} will be transferred to the bank account linked to your Flutterwave account. Transfers usually arrive within a few minutes.`}
        loading={busy}
      />

      <Modal open={disputeOpen} onClose={() => setDisputeOpen(false)} title="Raise a dispute" footer={null}>
        <form onSubmit={openDispute} className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-600">
            The money stays frozen in escrow while we look into it. Please describe exactly what went wrong - the clearer you are,
            the faster we can decide.
          </p>

          <input
            value={disputeReason}
            onChange={(event) => setDisputeReason(event.target.value)}
            placeholder="Short reason, e.g. Item never arrived"
            maxLength={120}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-200"
            required
          />

          <TextArea
            value={disputeDetails}
            onChange={(event) => setDisputeDetails(event.target.value)}
            rows={5}
            placeholder="What did you agree? What actually happened? What have you already tried?"
            required
          />

          <Button type="submit" fullWidth loading={busy}>
            Submit dispute
          </Button>
        </form>
      </Modal>

      {/* A small celebration when money moves successfully. */}
      <Celebration
        open={celebrate}
        onClose={() => setCelebrate(false)}
        variant="confetti"
        title={escrow.iAmPayer ? "Money released" : "Money collected"}
        message={
          escrow.iAmPayer
            ? `${escrow.otherParty.fullName.split(" ")[0]} has been paid. Thank you for using escrow.`
            : `${formatNaira(escrow.payoutKobo)} is on its way to your bank account.`
        }
      />
    </div>
  );
}

/**
 * stateLabel is re-exported here so callers do not need a second import.
 * WHY : Keeps the escrow vocabulary in one place in the UI layer.
 */
export { stateLabel };
