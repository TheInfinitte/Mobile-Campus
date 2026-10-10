/**
 * src/components/landlord/ViewingResponsePanel.tsx
 * WHAT: The confirm / decline / mark-completed controls for one viewing request.
 * WHY : The caretaker's three possible answers are all one tap each, and each one
 *       sends the student an in-app notification (plus an SMS for a confirmation,
 *       because a student needs to know for certain before travelling).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Input";
import { Celebration } from "@/components/ui/Celebration";
import { useToast } from "@/components/ui/Toast";
import { sendApi } from "@/lib/api-client";
import { CheckIcon, CloseIcon, ClockIcon } from "@/components/ui/Icons";

/** The viewing data this panel needs. */
export type ViewingResponseData = {
  id: string;
  status: string;
  caretakerReply: string | null;
  respondedAt: string | null;
  studentName: string;
  lodgeTitle: string;
};

/**
 * ViewingResponsePanel
 * WHAT: Sends the caretaker's decision to the API.
 */
export function ViewingResponsePanel({ viewing }: { viewing: ViewingResponseData }) {
  const router = useRouter();
  const toast = useToast();

  const [reply, setReply] = useState(viewing.caretakerReply ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  /** Sends a status change. */
  async function respond(status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
    if (status === "CANCELLED" && reply.trim().length < 5) {
      toast.error("Please tell the student why, so they can try another time.");
      return;
    }

    setBusy(status);
    const result = await sendApi<{ id: string; status: string }>(`/api/housing/viewings/${viewing.id}`, "PATCH", {
      status,
      reply: reply.trim() || undefined,
    });
    setBusy(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      status === "CONFIRMED" ? "Confirmed. The student has been told." : status === "COMPLETED" ? "Marked as completed." : "Declined."
    );
    setCelebrate(status === "CONFIRMED");
    router.refresh();
  }

  // Already handled - show the outcome instead of the buttons.
  if (viewing.status === "COMPLETED" || viewing.status === "CANCELLED" || viewing.status === "REJECTED") {
    return (
      <Card className="bg-slate-50">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ClockIcon size={16} className="text-slate-400" />
          This request is {viewing.status.toLowerCase()}
        </p>
        {viewing.caretakerReply ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{viewing.caretakerReply}</p> : null}
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-bold text-slate-900">
        {viewing.status === "CONFIRMED" ? "Already confirmed" : `Can ${viewing.studentName.split(" ")[0]} come and see it?`}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        {viewing.status === "CONFIRMED"
          ? "You have confirmed this viewing. Mark it completed once they have been, so your list stays tidy."
          : "Confirming sends the student a message with the time. If you cannot make it, decline with a reason and they will try another slot."}
      </p>

      <TextArea
        className="mt-3"
        label="Message to the student"
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        rows={3}
        placeholder="Come around 4pm. Ask for Chidi at the gate. Bring cash if you want to pay the booking fee."
      />

      <div className="mt-3 space-y-2">
        {viewing.status !== "CONFIRMED" ? (
          <Button fullWidth loading={busy === "CONFIRMED"} disabled={busy !== null && busy !== "CONFIRMED"} onClick={() => respond("CONFIRMED")}>
            <CheckIcon size={16} />
            Confirm this time
          </Button>
        ) : (
          <Button fullWidth loading={busy === "COMPLETED"} disabled={busy !== null && busy !== "COMPLETED"} onClick={() => respond("COMPLETED")}>
            <CheckIcon size={16} />
            Mark viewing as completed
          </Button>
        )}

        <Button
          variant="secondary"
          fullWidth
          loading={busy === "CANCELLED"}
          disabled={busy !== null && busy !== "CANCELLED"}
          onClick={() => respond("CANCELLED")}
        >
          <CloseIcon size={16} />
          Decline this request
        </Button>
      </div>

      <Celebration
        open={celebrate}
        onClose={() => setCelebrate(false)}
        variant="check"
        title="Viewing confirmed"
        message={`${viewing.studentName.split(" ")[0]} has been told. They will see it in the app and by SMS.`}
      />
    </Card>
  );
}
