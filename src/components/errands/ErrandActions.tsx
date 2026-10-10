/**
 * src/components/errands/ErrandActions.tsx
 * WHAT: The action buttons on one errand - Claim, Complete, Cancel/Release -
 *       plus the WhatsApp links that unlock after a claim.
 * WHY : The claim flow lives on the detail page, and each action changes who
 *       is allowed to do what, so the buttons must follow the errand state.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { whatsappLink } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/ui/Icons";

type ErrandActionsProps = {
  errandId: string;
  status: string;
  iAmPoster: boolean;
  iAmClaimer: boolean;
  isSignedIn: boolean;
  /** Poster's phone - only non-null once contacts are unlocked. */
  posterPhone: string | null;
  posterName: string;
  /** Claimer's phone - only non-null once contacts are unlocked. */
  claimerPhone: string | null;
  claimerName: string | null;
};

/**
 * ErrandActions
 * WHAT: Renders exactly the actions the signed-in user is allowed to take.
 */
export function ErrandActions(props: ErrandActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  /** Sends one action (CLAIM/COMPLETE/CANCEL) to the API. */
  async function act(action: "CLAIM" | "COMPLETE" | "CANCEL", successMessage: string) {
    setBusy(true);
    const result = await sendApi<{ status: string }>(`/api/errands/${props.errandId}`, "PATCH", { action });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "That did not work.");
      return;
    }
    toast.success(successMessage);
    // The page re-renders from the database so the new state shows.
    router.refresh();
  }

  // OPEN: any other signed-in student can claim it.
  if (props.status === "OPEN" && !props.iAmPoster) {
    return (
      <div className="space-y-2">
        <Button fullWidth loading={busy} disabled={!props.isSignedIn} onClick={() => act("CLAIM", "Claimed! Coordinate the handover below.")}>
          {props.isSignedIn ? "Claim this errand" : "Sign in to claim"}
        </Button>
        {props.isSignedIn ? null : (
          <p className="text-center text-[11px] text-slate-400">You need a verified student account to claim errands.</p>
        )}
      </div>
    );
  }

  // CLAIMED: poster can confirm completion or cancel; claimer can release.
  if (props.status === "CLAIMED") {
    return (
      <div className="space-y-2">
        {/* The handover contacts - unlocked for exactly these two people. */}
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Handover contacts</p>
          {props.posterPhone ? (
            <a
              href={whatsappLink(props.posterPhone, `Hi ${props.posterName}, I am coordinating the errand handover on Mobile Campus.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-success-dark underline"
            >
              <WhatsAppIcon size={14} /> {props.posterName} (poster)
            </a>
          ) : null}
          {props.claimerPhone ? (
            <a
              href={whatsappLink(props.claimerPhone, `Hi ${props.claimerName}, about the errand handover on Mobile Campus.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 ml-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-success-dark underline"
            >
              <WhatsAppIcon size={14} /> {props.claimerName} (mover)
            </a>
          ) : null}
        </div>

        {props.iAmPoster ? (
          <>
            <Button fullWidth variant="primary" loading={busy} onClick={() => act("COMPLETE", "Marked complete. Settle the fee with your mover.")}>
              Item received - mark complete
            </Button>
            <Button fullWidth variant="ghost" loading={busy} onClick={() => act("CANCEL", "Errand cancelled.")}>
              Cancel errand
            </Button>
          </>
        ) : null}
        {props.iAmClaimer ? (
          <Button fullWidth variant="ghost" loading={busy} onClick={() => act("CANCEL", "Released - the errand is back on the board.")}>
            I can&apos;t do this - release task
          </Button>
        ) : null}
      </div>
    );
  }

  // OPEN + poster, or a terminal state: nothing to do but a hint.
  return (
    <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">
      {props.status === "OPEN"
        ? "Waiting for a mover to claim this errand."
        : props.status === "COMPLETED"
          ? "This errand was completed. Thank you for using the board!"
          : "This errand was cancelled."}
    </p>
  );
}
