/**
 * src/components/shared/EscrowActions.tsx
 * WHAT: The client-side actions shared by market items and gigs: pay with
 *       escrow (with the full fee breakdown), shortlist, report, and accept a gig.
 * WHY : Both the marketplace and the gig board need exactly the same money flow.
 *       One component means the fee breakdown and the escrow explanation are
 *       identical everywhere - a buyer never sees two different versions.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FeeBreakdown } from "@/components/escrow/FeeBreakdown";
import { Celebration } from "@/components/ui/Celebration";
import { ReportModal } from "@/components/shared/ReportModal";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { formatNaira } from "@/lib/money";
import { LockIcon, HeartIcon, AlertIcon } from "@/components/ui/Icons";

type EscrowActionsProps = {
  /** What is being paid for. */
  type: "PURCHASE" | "SERVICE";
  /** The id of the item or gig. */
  targetId: string;
  /** Human title, used in the fee breakdown. */
  title: string;
  /** The price of the item or the gig fee, in kobo. */
  amountKobo: number;
  /** The fee lines the server calculated for this price. */
  feeLines: { key: string; label: string; amountKobo: number; note?: string }[];
  /** What the buyer pays in total. */
  totalKobo: number;
  /** What the seller receives. */
  payoutKobo: number;
  /** Is the signed-in user allowed to pay? (provisional accounts are not) */
  canPay: boolean;
  signedIn: boolean;
  /** The note shown to provisional accounts. */
  upgradeNote: string;
  /** Shortlist state and toggle availability. */
  shortlisted: boolean;
  /** For gigs: extra action buttons. */
  gigActions?: {
    canAccept: boolean;
    canComplete: boolean;
    canCancel: boolean;
    status: string;
  };
  /** Id of the user being reported (the seller or the poster). */
  reportedUserId?: string;
};

/**
 * EscrowActions
 * WHAT: Renders the pay button, the fee sheet, the shortlist heart, the report
 *       button and (for gigs) accept/complete/cancel.
 * WHY : Every money action on the platform goes through here, so the escrow
 *       guarantees are the same no matter what is being bought.
 */
export function EscrowActions({
  type,
  targetId,
  title,
  amountKobo,
  feeLines,
  totalKobo,
  payoutKobo,
  canPay,
  signedIn,
  upgradeNote,
  shortlisted,
  gigActions,
  reportedUserId,
}: EscrowActionsProps) {
  const router = useRouter();
  const toast = useToast();

  const [payOpen, setPayOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [saved, setSaved] = useState(shortlisted);

  /** Adds or removes the shortlist entry. */
  async function toggleShortlist() {
    if (!signedIn) {
      router.push("/auth/login");
      return;
    }
    const body = type === "PURCHASE" ? { marketItemId: targetId } : { gigId: targetId };
    const result = await sendApi<{ shortlisted: boolean }>("/api/shortlist", "POST", body);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSaved(result.data?.shortlisted ?? false);
    toast.success(result.data?.shortlisted ? "Saved to your shortlist." : "Removed from your shortlist.");
  }

  /** Creates the escrow and opens the Flutterwave checkout. */
  async function startPayment() {
    setBusy(true);
    const body = type === "PURCHASE" ? { type, marketItemId: targetId } : { type, gigId: targetId };
    const result = await sendApi<{ paymentUrl: string }>("/api/payments", "POST", body);
    setBusy(false);

    if (!result.ok || !result.data?.paymentUrl) {
      toast.error(result.error || "We could not start the payment.");
      return;
    }

    setPayOpen(false);
    setCelebrate(true);
    // A brief pause so the celebration is seen before we navigate away.
    setTimeout(() => {
      window.location.href = result.data!.paymentUrl;
    }, 900);
  }

  /** Accepts, completes or cancels a gig. */
  async function gigAction(action: "ACCEPT" | "COMPLETE" | "CANCEL") {
    setBusy(true);
    const result = await sendApi<{ status: string }>(`/api/gigs/${targetId}`, "PATCH", { action });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      action === "ACCEPT" ? "You accepted this task." : action === "COMPLETE" ? "Marked as complete." : "Task cancelled."
    );
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {/* --------------------------------------------------------------- */}
      {/* PRIMARY ACTION                                                   */}
      {/* --------------------------------------------------------------- */}
      {type === "SERVICE" && gigActions?.canAccept ? (
        <Button fullWidth loading={busy} onClick={() => void gigAction("ACCEPT")}>
          Accept this task
        </Button>
      ) : (
        <Button fullWidth disabled={!canPay} onClick={() => setPayOpen(true)}>
          <LockIcon size={16} />
          Pay {formatNaira(totalKobo)} with escrow
        </Button>
      )}

      {/* Secondary gig actions */}
      {gigActions?.canComplete ? (
        <Button variant="secondary" fullWidth loading={busy} onClick={() => void gigAction("COMPLETE")}>
          Mark job as complete
        </Button>
      ) : null}
      {gigActions?.canCancel ? (
        <Button variant="ghost" fullWidth loading={busy} onClick={() => void gigAction("CANCEL")} className="text-danger">
          Cancel task
        </Button>
      ) : null}

      {/* Shortlist + report row */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={toggleShortlist} icon={<HeartIcon size={16} filled={saved} className={saved ? "text-danger" : ""} />}>
          {saved ? "Saved" : "Shortlist"}
        </Button>
        <Button variant="secondary" onClick={() => setReportOpen(true)} icon={<AlertIcon size={16} />} className="text-danger">
          Report
        </Button>
      </div>

      {/* The escrow promise, repeated at the point of decision. */}
      <p className="flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-slate-500">
        <LockIcon size={13} className="mt-px shrink-0" />
        Your money stays in escrow until you confirm you have received the item. If it is not as described, open a dispute
        before confirming.
      </p>

      {/* Why a provisional account cannot pay. */}
      {!canPay ? (
        <p className="rounded-xl bg-warn-light p-3 text-[11px] leading-relaxed text-warn-dark">{upgradeNote}</p>
      ) : null}

      {/* --------------------------------------------------------------- */}
      {/* FEE BREAKDOWN SHEET                                              */}
      {/* --------------------------------------------------------------- */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Confirm and pay"
        footer={
          <Button fullWidth loading={busy} onClick={startPayment}>
            Pay {formatNaira(totalKobo)}
          </Button>
        }
      >
        <div className="pb-3">
          <FeeBreakdown
            itemLabel={title}
            itemKobo={amountKobo}
            feeLines={feeLines}
            totalKobo={totalKobo}
            payoutKobo={payoutKobo}
            note="One-time payment through Flutterwave"
          />
        </div>
      </Modal>

      {/* --------------------------------------------------------------- */}
      {/* REPORT + CELEBRATION                                             */}
      {/* --------------------------------------------------------------- */}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        marketItemId={type === "PURCHASE" ? targetId : undefined}
        gigId={type === "SERVICE" ? targetId : undefined}
        reportedUserId={reportedUserId}
        subject={title}
      />

      <Celebration
        open={celebrate}
        onClose={() => setCelebrate(false)}
        title="Payment started 🎉"
        message="Complete the payment on Flutterwave. Your money will be held safely until you confirm."
        variant="confetti"
      />
    </div>
  );
}
