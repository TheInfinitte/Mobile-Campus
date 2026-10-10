/**
 * src/components/admin/AdminQueueItem.tsx
 * WHAT: One row in the admin queues - a verification to review, a dispute to
 *       resolve, or a report to investigate.
 * WHY : Admins work through these queues on a phone as often as on a laptop. The
 *       row must show the evidence, the identity (masked), and the decision
 *       buttons without scrolling sideways.
 *
 * PRIVACY: Matric, JAMB and ID numbers are shown masked (****0142). The admin can
 * reveal the full value only through a separate, logged API call.
 */
"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/SmartImage";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EyeIcon, ShieldIcon, AlertIcon } from "@/components/ui/Icons";
import { cn, formatDate } from "@/lib/utils";
import { sendApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

/** A verification row in the queue. */
export type VerificationQueueItem = {
  id: string;
  type: string;
  status: string;
  identifierLast4: string | null;
  documentUrls: string[];
  adminNote: string | null;
  submittedAt: string;
  user: { id: string; fullName: string; phone: string; avatarUrl: string | null; role: string };
};

/**
 * VerificationQueueRow
 * WHAT: Shows the uploaded document, who submitted it, and approve/reject buttons.
 * WHY : This is where trust on the platform is decided, so the document must be
 *       big enough to read and the decision must be one tap.
 */
export function VerificationQueueRow({ item, onChanged }: { item: VerificationQueueItem; onChanged: () => void }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /** Sends the admin's decision to the API. */
  async function decide(decision: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO", note?: string) {
    setBusy(decision);

    const result = await sendApi<{ id: string }>(`/api/admin/verifications/${item.id}`, "PATCH", { decision, note });

    setBusy(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      decision === "APPROVED"
        ? `${item.user.fullName.split(" ")[0]} is now verified.`
        : decision === "REJECTED"
          ? "Verification rejected."
          : "Asked for a clearer document."
    );
    onChanged();
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      {/* Who and what */}
      <div className="flex items-start gap-3">
        <Avatar src={item.user.avatarUrl} name={item.user.fullName} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{item.user.fullName}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {item.user.phone} • {labelForType(item.type)} • {formatDate(item.submittedAt)}
          </p>
          {/* The identifier is always masked. Never show the full number. */}
          {item.identifierLast4 ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              <ShieldIcon size={11} />
              ID ending ****{item.identifierLast4}
            </p>
          ) : null}
        </div>
      </div>

      {/* The uploaded documents */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {item.documentUrls.map((url, index) => (
          <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="shrink-0">
            <img
              src={url}
              alt={`Uploaded document ${index + 1}`}
              loading="lazy"
              className={cn(
                "rounded-xl border border-slate-200 object-cover",
                expanded ? "h-56 w-full" : "h-24 w-32"
              )}
            />
          </a>
        ))}
        {item.documentUrls.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">No document attached.</p>
        ) : null}
      </div>

      {item.documentUrls.length > 1 ? (
        <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-2 text-xs font-semibold text-primary-700">
          {expanded ? "Show thumbnails" : "Enlarge documents"}
        </button>
      ) : null}

      {item.adminNote ? (
        <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">Last note: {item.adminNote}</p>
      ) : null}

      {/* Decisions - only shown for items still waiting. */}
      {item.status === "PENDING" || item.status === "NEEDS_MORE_INFO" ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button size="sm" onClick={() => void decide("APPROVED")} loading={busy === "APPROVED"} className="col-span-1">
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void decide("NEEDS_MORE_INFO")} loading={busy === "NEEDS_MORE_INFO"}>
            Ask again
          </Button>
          <Button size="sm" variant="danger" onClick={() => void decide("REJECTED")} loading={busy === "REJECTED"}>
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Plain-English label for a verification type. */
function labelForType(type: string): string {
  switch (type) {
    case "STUDENT_ID":
      return "Student ID + matric number";
    case "FRESHER_JAMB":
      return "JAMB admission proof";
    case "LANDLORD_DOC":
      return "Landlord document";
    default:
      return type;
  }
}

/** A dispute row in the admin queue. */
export type DisputeQueueItem = {
  id: string;
  status: string;
  reason: string;
  details: string;
  evidenceUrls: string[];
  createdAt: string;
  escrow: {
    id: string;
    reference: string;
    state: string;
    type: string;
    totalKobo: number;
    payoutKobo: number;
    payer: { fullName: string; phone: string };
    payee: { fullName: string; phone: string };
  };
  raisedBy: { fullName: string };
};

/**
 * DisputeQueueRow
 * WHAT: Shows both sides of a disputed payment and the resolve buttons.
 * WHY : An admin has to decide who gets the money. Both names, both phone
 *       numbers and the amount must be on screen at the same time.
 */
export function DisputeQueueRow({ item, onChanged }: { item: DisputeQueueItem; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  /** Records the admin's decision. */
  async function resolve(decision: "RESOLVED_FOR_PAYER" | "RESOLVED_FOR_PAYEE") {
    if (resolution.trim().length < 10) {
      toast.error("Write at least a sentence explaining the decision.");
      return;
    }

    setBusy(decision);
    const result = await sendApi<{ id: string }>(`/api/admin/disputes/${item.id}`, "PATCH", { decision, resolution });
    setBusy(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Dispute resolved. Both parties have been notified.");
    onChanged();
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-danger/20">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertIcon size={18} className="text-danger" />
          <p className="text-sm font-bold text-slate-900">{item.reason}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* The payment in dispute */}
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[11px]">
        <div>
          <p className="text-slate-400">Reference</p>
          <p className="font-semibold text-slate-800">{item.escrow.reference}</p>
        </div>
        <div>
          <p className="text-slate-400">Amount held</p>
          <p className="font-semibold text-slate-800">₦{(item.escrow.totalKobo / 100).toLocaleString("en-NG")}</p>
        </div>
        <div>
          <p className="text-slate-400">Payer (buyer/tenant)</p>
          <p className="font-semibold text-slate-800">
            {item.escrow.payer.fullName} • {item.escrow.payer.phone}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Payee (seller/landlord)</p>
          <p className="font-semibold text-slate-800">
            {item.escrow.payee.fullName} • {item.escrow.payee.phone}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">{item.details}</p>

      {/* Evidence */}
      {item.evidenceUrls.length > 0 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {item.evidenceUrls.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer noopener">
              <img src={url} alt={`Evidence ${index + 1}`} loading="lazy" className="h-24 w-32 shrink-0 rounded-xl border border-slate-200 object-cover" />
            </a>
          ))}
        </div>
      ) : null}

      {item.status === "OPEN" || item.status === "UNDER_REVIEW" ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            rows={3}
            placeholder="Explain your decision. Both parties will read this."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-primary-400 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => void resolve("RESOLVED_FOR_PAYER")} loading={busy === "RESOLVED_FOR_PAYER"}>
              Refund payer
            </Button>
            <Button size="sm" onClick={() => void resolve("RESOLVED_FOR_PAYEE")} loading={busy === "RESOLVED_FOR_PAYEE"}>
              Release to seller
            </Button>
          </div>
        </div>
      ) : (
        <Badge tone="success" className="mt-3">
          Resolved
        </Badge>
      )}
    </div>
  );
}

/** A report row in the admin queue. */
export type ReportQueueItem = {
  id: string;
  type: string;
  status: string;
  details: string;
  createdAt: string;
  reporter: { fullName: string; phone: string };
  reportedUser: { fullName: string; phone: string } | null;
  subjectLabel: string;
  subjectHref: string | null;
};

/**
 * ReportQueueRow
 * WHAT: Shows a scam/fake-listing report with resolve and dismiss buttons.
 * WHY : Reports need a fast triage path: look at it, resolve it or dismiss it.
 */
export function ReportQueueRow({ item, onChanged }: { item: ReportQueueItem; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  /** Updates the report status. */
  async function setStatus(status: "INVESTIGATING" | "RESOLVED" | "DISMISSED") {
    setBusy(status);
    const result = await sendApi<{ id: string }>(`/api/admin/reports/${item.id}`, "PATCH", { status });
    setBusy(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Report updated.");
    onChanged();
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{item.type.replace(/_/g, " ")}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {formatDate(item.createdAt)} • Reported by {item.reporter.fullName}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{item.details}</p>

      {item.subjectHref ? (
        <a href={item.subjectHref} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
          <EyeIcon size={14} />
          Open {item.subjectLabel}
        </a>
      ) : null}

      {item.reportedUser ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Reported user: <strong>{item.reportedUser.fullName}</strong> • {item.reportedUser.phone}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button size="sm" variant="secondary" onClick={() => void setStatus("INVESTIGATING")} loading={busy === "INVESTIGATING"}>
          Investigate
        </Button>
        <Button size="sm" onClick={() => void setStatus("RESOLVED")} loading={busy === "RESOLVED"}>
          Resolve
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void setStatus("DISMISSED")} loading={busy === "DISMISSED"}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
