/**
 * src/components/admin/StudyQueueClient.tsx
 * WHAT: Moderation queue for Study Vault uploads: preview the file, approve or
 *       reject. Approval grants the uploader 2 download credits (give-to-get).
 * WHY : A human gate keeps the vault trustworthy; the credit reward is applied
 *       server-side in the same transaction as the decision.
 */
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SmartImage } from "@/components/ui/SmartImage";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import { sendApi } from "@/lib/api-client";
import { STUDY_KIND_LABELS } from "@/lib/data";
import { formatDate } from "@/lib/utils";

type DocRow = {
  id: string;
  title: string;
  department: string;
  courseCode: string;
  kind: string;
  description: string | null;
  fileUrl: string;
  pages: number | null;
  status: string;
  downloads: number;
  createdAt: string;
  institution: string;
  uploader: { id: string; fullName: string; phone: string; level: string | null };
};

/**
 * StudyQueueClient
 * WHAT: Lists PENDING documents (toggle to ALL) with decision buttons.
 */
export function StudyQueueClient() {
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const { data, loading, refetch } = useFetch<{ documents: DocRow[] }>(`/api/admin/study?status=${showAll ? "ALL" : "PENDING"}`);

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    const result = await sendApi<{ id: string }>(`/api/admin/study`, "PATCH", { id, decision });
    if (!result.ok) {
      toast.error(result.error ?? "Could not update.");
      return;
    }
    toast.success(decision === "APPROVED" ? "Approved - uploader earned 2 credits." : "Rejected.");
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-slate-900">Study uploads</p>
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="ml-auto min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
        >
          {showAll ? "Show pending only" : "Show all"}
        </button>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : (data?.documents ?? []).length === 0 ? (
        <Card>
          <p className="p-6 text-center text-sm text-slate-500">Nothing waiting for review.</p>
        </Card>
      ) : (
        (data?.documents ?? []).map((doc) => (
          <Card key={doc.id}>
            <div className="flex gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                <SmartImage src={doc.fileUrl} alt={doc.title} width={160} rounded="lg" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900">{doc.title}</p>
                  <Badge tone="primary">{STUDY_KIND_LABELS[doc.kind] ?? doc.kind}</Badge>
                  <Badge tone={doc.status === "APPROVED" ? "primary" : doc.status === "PENDING" ? "gold" : "slate"}>{doc.status}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {doc.institution} · {doc.department} · {doc.courseCode} · {doc.uploader.fullName} ({doc.uploader.phone}) · {formatDate(doc.createdAt)}
                </p>
                {doc.description ? <p className="mt-1 text-xs text-slate-600">{doc.description}</p> : null}
                {doc.status === "PENDING" ? (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => decide(doc.id, "APPROVED")}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => decide(doc.id, "REJECTED")}>Reject</Button>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">{doc.downloads} downloads</p>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
