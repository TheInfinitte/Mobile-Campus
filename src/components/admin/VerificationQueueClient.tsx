/**
 * src/components/admin/VerificationQueueClient.tsx
 * WHAT: The interactive verification queue - status tabs and the review rows.
 * WHY : It fetches on the client so an admin can approve ten submissions in a row
 *       without the page reloading and losing their place.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, EmptyState } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StaggerList } from "@/components/motion/StaggerList";
import { VerificationQueueRow, type VerificationQueueItem } from "@/components/admin/AdminQueueItem";
import { ShieldIcon, CheckIcon } from "@/components/ui/Icons";
import { useFetch } from "@/hooks/useFetch";
import { cn } from "@/lib/utils";

/** The tab options, in the order an admin works through them. */
const TABS = [
  { value: "PENDING", label: "Waiting" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "NEEDS_MORE_INFO", label: "More info" },
  { value: "ALL", label: "All" },
];

/**
 * VerificationQueueClient
 * WHAT: Loads the queue for the chosen status and renders the rows.
 */
export function VerificationQueueClient({ counts }: { counts: Record<string, number> }) {
  const [status, setStatus] = useState("PENDING");

  // Refetch whenever the tab changes, and again after a decision.
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading } = useFetch<{ records: VerificationQueueItem[] }>(`/api/admin/verifications?status=${status}&_=${reloadKey}`);

  // Bumping the key is enough to trigger the effect inside useFetch.
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // Scroll back to the top when switching tabs, so the admin starts at the oldest.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [status]);

  const records = data?.records ?? [];

  return (
    <div>
      {/* ------------------------------------------------------------ */}
      {/* STATUS TABS                                                    */}
      {/* ------------------------------------------------------------ */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            aria-pressed={status === tab.value}
            className={cn(
              "mc-chip shrink-0",
              status === tab.value ? "border-primary-600 bg-primary-600 text-white" : ""
            )}
          >
            {tab.label}
            {tab.value !== "ALL" && counts[tab.value] ? <span className="ml-1 font-bold">({counts[tab.value]})</span> : null}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------ */}
      {/* THE QUEUE                                                      */}
      {/* ------------------------------------------------------------ */}
      {loading && records.length === 0 ? (
        <ListSkeleton rows={3} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={<CheckIcon size={32} />}
          title={status === "PENDING" ? "Queue is clear" : "Nothing here"}
          message={
            status === "PENDING"
              ? "Every submission has been reviewed. New ones arrive by SMS to the admin number, so you will know when there is more."
              : "No submissions in this state yet."
          }
        />
      ) : (
        <>
          <p className="mb-3 px-1 text-[11px] text-slate-500">
            {records.length} {records.length === 1 ? "submission" : "submissions"}, oldest first. Numbers are encrypted, so you
            will only ever see the last four digits.
          </p>

          <StaggerList gap={12} inView>
            {records.map((item) => (
              <VerificationQueueRow key={item.id} item={item} onChanged={refresh} />
            ))}
          </StaggerList>
        </>
      )}

      <Card className="mt-6 bg-slate-50">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
          <ShieldIcon size={14} className="mt-px shrink-0 text-slate-400" />
          Before approving: the name on the document must match the account name, the photo must be readable, and the last four
          digits the student typed must match the document. If any of those fail, choose &ldquo;needs more info&rdquo; and say
          exactly what to resend.
        </p>
      </Card>
    </div>
  );
}
