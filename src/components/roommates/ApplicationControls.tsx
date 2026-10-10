/**
 * src/components/roommates/ApplicationControls.tsx
 * WHAT: Two things in one component - the "Apply" form for a student looking at a
 *       post, and the accept / decline buttons for the person who posted it.
 * WHY : Both actions hit the same endpoint, and keeping them together means the
 *       compatibility score is shown the same way on both sides.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Celebration } from "@/components/ui/Celebration";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { CheckIcon, CloseIcon, SendIcon } from "@/components/ui/Icons";

/** An existing application, when the author is managing their list. */
export type ApplicationData = {
  id: string;
  status: string;
  applicantName: string;
};

type Props = {
  /** The post being applied to, or the post the author owns. */
  postId: string;
  /** Set when the viewer is the post author - renders accept/decline instead. */
  application?: ApplicationData;
  /** Only verified students may apply. */
  canApply?: boolean;
};

/**
 * ApplicationControls
 * WHAT: Applies to a post, or decides on an existing application.
 */
export function ApplicationControls({ postId, application, canApply = true }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // ------------------------------------------------------------
  // THE AUTHOR'S VIEW
  // ------------------------------------------------------------
  if (application) {
    /** Accepts or declines an application, which frees or fills a slot. */
    async function decide(decision: "ACCEPTED" | "DECLINED") {
      setBusy(true);
      const result = await sendApi<{ id: string }>(`/api/roommates/posts/${postId}/applications/${application!.id}`, "PATCH", { decision });
      setBusy(false);

      if (!result.ok) {
        toast.error(result.error);
        setDeclineOpen(false);
        return;
      }

      setDeclineOpen(false);
      toast.success(decision === "ACCEPTED" ? `${application!.applicantName.split(" ")[0]} is in your group.` : "Declined.");
      router.refresh();
    }

    // Already decided - show the outcome instead of buttons.
    if (application.status !== "PENDING") {
      return (
        <p
          className={`mt-3 rounded-xl p-3 text-xs font-semibold ${
            application.status === "ACCEPTED" ? "bg-success-light text-success-dark" : "bg-slate-100 text-slate-500"
          }`}
        >
          {application.status === "ACCEPTED"
            ? `You accepted ${application.applicantName.split(" ")[0]}. They can now see your phone number.`
            : `You declined ${application.applicantName.split(" ")[0]}.`}
        </p>
      );
    }

    return (
      <>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" loading={busy} onClick={() => decide("ACCEPTED")}>
            <CheckIcon size={15} />
            Accept
          </Button>
          <Button size="sm" variant="secondary" className="flex-1" disabled={busy} onClick={() => setDeclineOpen(true)}>
            <CloseIcon size={15} />
            Decline
          </Button>
        </div>

        <ConfirmDialog
          open={declineOpen}
          onClose={() => setDeclineOpen(false)}
          onConfirm={() => decide("DECLINED")}
          loading={busy}
          title="Decline this application?"
          confirmLabel="Decline"
          message={`${application.applicantName.split(" ")[0]} will be told this group chose someone else. They can still apply to other posts.`}
        />
      </>
    );
  }

  // ------------------------------------------------------------
  // THE APPLICANT'S VIEW
  // ------------------------------------------------------------
  if (!canApply) {
    return (
      <p className="rounded-xl bg-warn-light p-3 text-xs leading-relaxed text-warn-dark">
        Applying to a roommate post is only open to verified students. Verify with your student ID and this button will appear.
      </p>
    );
  }

  /** Sends the application. */
  async function apply(event: React.FormEvent) {
    event.preventDefault();

    if (message.trim().length < 10) {
      toast.error("Say a little about yourself - at least a sentence.");
      return;
    }

    setBusy(true);
    const result = await sendApi<{ id: string; compatibilityScore: number }>(`/api/roommates/posts/${postId}/applications`, "POST", {
      message: message.trim(),
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setOpen(false);
    setCelebrate(true);
    toast.success(`You are a ${result.data?.compatibilityScore ?? 0}% match. Applied.`);
    router.refresh();
  }

  return (
    <>
      <Button fullWidth onClick={() => setOpen(true)}>
        <SendIcon size={16} />
        Apply to join
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Apply to join this group" footer={null}>
        <form onSubmit={apply} className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-600">
            Tell them how you live, not just that you want the room. Mention your sleep times, whether you are neat, and anything
            you already have - a generator or a fridge makes you an easy yes.
          </p>

          <TextArea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            placeholder="I am a 300L Computer Science student. I sleep by 11pm and I am very neat. I have a small fridge I am happy to share."
            required
          />

          <Button type="submit" fullWidth loading={busy}>
            Send application
          </Button>
        </form>
      </Modal>

      <Celebration
        open={celebrate}
        onClose={() => setCelebrate(false)}
        variant="confetti"
        title="Application sent"
        message="We have told them you are interested. Most authors reply within a day."
      />
    </>
  );
}
