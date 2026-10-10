/**
 * src/components/admin/ReportQueueClient.tsx
 * WHAT: The interactive report queue with dismiss / investigating / remove actions.
 * WHY : Most reports turn out to be misunderstandings, so dismissing quickly is
 *       just as important as acting fast on a real scam.
 */
"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StaggerList } from "@/components/motion/StaggerList";
import { TextArea } from "@/components/ui/Input";
import { InfoIcon, CheckIcon, AlertIcon, ChevronRightIcon } from "@/components/ui/Icons";
import { sendApi } from "@/lib/api-client";
import { useFetch } from "@/hooks/useFetch";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, telLink } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** One report as the API returns it. */
type ReportItem = {
  id: string;
  type: string;
  status: string;
  details: string;
  adminNote: string | null;
  createdAt: string;
  reporter: { id: string; fullName: string; phone: string };
  reportedUser: { id: string; fullName: string; phone: string } | null;
  subjectLabel: string;
  subjectHref: string | null;
};

const TABS = [
  { value: "OPEN", label: "Open" },
  { value: "INVESTIGATING", label: "Investigating" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "ALL", label: "All" },
];

/**
 * ReportQueueClient
 * WHAT: Lists reports and sends the admin's decision.
 */
export function ReportQueueClient({ counts }: { counts: Record<string, number> }) {
  const toast = useToast();
  const [status, setStatus] = useState("OPEN");
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading } = useFetch<{ reports: ReportItem[] }>(`/api/admin/reports?status=${status}&_=${reloadKey}`);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const reports = data?.reports ?? [];

  /** Records a decision on one report. */
  async function decide(item: ReportItem, decision: "INVESTIGATING" | "RESOLVED" | "DISMISSED", note?: string) {
    const result = await sendApi<{ id: string }>(`/api/admin/reports/${item.id}`, "PATCH", { status: decision, adminNote: note });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      decision === "DISMISSED"
        ? "Dismissed. The reporter will be told nothing was found."
        : decision === "RESOLVED"
          ? "Marked resolved."
          : "Marked as investigating."
    );
    refresh();
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            aria-pressed={status === tab.value}
            className={cn("mc-chip shrink-0", status === tab.value ? "border-primary-600 bg-primary-600 text-white" : "")}
          >
            {tab.label}
            {tab.value !== "ALL" && counts[tab.value] ? <span className="ml-1 font-bold">({counts[tab.value]})</span> : null}
          </button>
        ))}
      </div>

      {loading && reports.length === 0 ? (
        <ListSkeleton rows={3} />
      ) : reports.length === 0 ? (
        <EmptyState icon={<CheckIcon size={32} />} title="No reports here" message="Nothing needs your attention in this state." />
      ) : (
        <StaggerList gap={12} inView>
          {reports.map((report) => (
            <ReportRow key={report.id} report={report} onDecide={decide} />
          ))}
        </StaggerList>
      )}

      <Card className="mt-6 bg-slate-50">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
          <InfoIcon size={14} className="mt-px shrink-0 text-slate-400" />
          A report is an allegation, not a verdict. Check the listing yourself, and call the reporter if the detail is thin.
          Dismissing a report tells the reporter we looked and found nothing - it does not accuse them of lying.
        </p>
      </Card>
    </div>
  );
}

/**
 * ReportRow
 * WHAT: One report card with the reporter, the subject and the decision buttons.
 */
function ReportRow({
  report,
  onDecide,
}: {
  report: ReportItem;
  onDecide: (item: ReportItem, decision: "INVESTIGATING" | "RESOLVED" | "DISMISSED", note?: string) => void;
}) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const isScam = report.type === "SCAM" || report.type === "FAKE_LISTING";

  return (
    <Card className={isScam && report.status === "OPEN" ? "border border-danger/30" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <Badge tone={isScam ? "danger" : "slate"}>{report.type.toLowerCase().replace("_", " ")}</Badge>
            <StatusBadge status={report.status} />
          </p>
          <p className="mt-1.5 text-sm font-bold text-slate-900">About {report.subjectLabel}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Reported by {report.reporter.fullName} · {formatDateTime(report.createdAt)}
          </p>
        </div>

        {report.subjectHref ? (
          <Link href={report.subjectHref} className="mc-btn-secondary h-9 shrink-0 px-2.5 text-[11px]">
            View
            <ChevronRightIcon size={13} />
          </Link>
        ) : null}
      </div>

      <p className="mt-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{report.details}</p>

      {/* Direct lines to the people involved. */}
      <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
        <a href={telLink(report.reporter.phone)} className="mc-chip">
          Call reporter
        </a>
        {report.reportedUser ? (
          <a href={telLink(report.reportedUser.phone)} className="mc-chip border-danger/30 text-danger-dark">
            Call {report.reportedUser.fullName.split(" ")[0]}
          </a>
        ) : null}
      </div>

      {report.adminNote ? (
        <p className="mt-2.5 rounded-xl bg-primary-50 p-2.5 text-[11px] leading-relaxed text-primary-900">
          <strong>Your note:</strong> {report.adminNote}
        </p>
      ) : null}

      {report.status === "OPEN" || report.status === "INVESTIGATING" ? (
        <>
          <button type="button" onClick={() => setOpen((current) => !current)} className="mc-btn-ghost mt-3 w-full">
            {open ? "Hide decision" : "Add a decision"}
          </button>

          {open ? (
            <div className="mt-2 space-y-2">
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="What did you find? Both the reporter and the other user may see this." />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDecide(report, "INVESTIGATING", note.trim() || undefined)}
                  className="mc-btn-secondary flex-1"
                >
                  <AlertIcon size={15} />
                  Investigating
                </button>
                <button type="button" onClick={() => onDecide(report, "DISMISSED", note.trim() || undefined)} className="mc-btn-secondary flex-1">
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(report, "RESOLVED", note.trim() || undefined)}
                  className="mc-btn-primary flex-1"
                >
                  <CheckIcon size={15} />
                  Resolve
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
