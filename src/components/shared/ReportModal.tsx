/**
 * src/components/shared/ReportModal.tsx
 * WHAT: The "Report scam" / "Report this listing" form. It sends the report to
 *       the admin queue.
 * WHY : Scam reports are how the platform protects the next student. The form is
 *       deliberately short - a frightened student will not fill in ten fields.
 */
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select, TextArea } from "@/components/ui/Input";
import { AlertIcon } from "@/components/ui/Icons";
import { sendApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

type ReportModalProps = {
  open: boolean;
  onClose: () => void;
  /** What is being reported - exactly one of these is set. */
  lodgeId?: string;
  marketItemId?: string;
  gigId?: string;
  communityPostId?: string;
  reportedUserId?: string;
  /** Shown in the header so the user knows what they are reporting. */
  subject: string;
};

/** The report types, matching the ReportType enum in the database. */
const REPORT_TYPES = [
  { value: "SCAM", label: "Scam or fraud" },
  { value: "FAKE_LISTING", label: "Fake or misleading listing" },
  { value: "HARASSMENT", label: "Harassment or threats" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "OTHER", label: "Something else" },
];

/**
 * ReportModal
 * WHAT: A two-field report form in a bottom sheet.
 * WHY : Placed in a modal so it can be opened from any card without navigating
 *       away from the list.
 */
export function ReportModal({ open, onClose, lodgeId, marketItemId, gigId, communityPostId, reportedUserId, subject }: ReportModalProps) {
  const toast = useToast();
  const [type, setType] = useState("SCAM");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /** Sends the report and closes the sheet on success. */
  async function submit() {
    setSaving(true);
    setError("");

    const result = await sendApi<{ id: string }>("/api/reports", "POST", {
      type,
      details,
      lodgeId,
      communityPostId,
      marketItemId,
      gigId,
      reportedUserId,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Report sent. Our team will review it within 24 hours.");
    setDetails("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a problem"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={saving} className="flex-[2]">
            Send report
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        {/* What is being reported, so the user can confirm it is the right thing. */}
        <div className="flex items-start gap-2 rounded-xl bg-danger-light p-3">
          <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-xs leading-relaxed text-danger-dark">
            Reporting <strong>{subject}</strong>. If you are in immediate danger, call the police first.
          </p>
        </div>

        <Select label="What is the problem?" value={type} onChange={(event) => setType(event.target.value)} options={REPORT_TYPES} />

        <TextArea
          label="Tell us what happened"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={5}
          placeholder="Include dates, amounts and anything the person said. Screenshots can be added later by our team."
          error={error}
        />

        <p className="text-[11px] leading-relaxed text-slate-500">
          Your report is confidential. The person you are reporting will not see your name. Repeated false reports can get
          an account suspended.
        </p>
      </div>
    </Modal>
  );
}
