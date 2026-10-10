/**
 * src/components/admin/DisputeQueueClient.tsx
 * WHAT: The interactive dispute queue.
 * WHY : Resolving a dispute is the highest-stakes action in the admin area, so the
 *       frozen total stays visible at the top of the screen the whole time.
 */
"use client";

import { useCallback, useState } from "react";
import { Card, EmptyState } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StaggerList } from "@/components/motion/StaggerList";
import { DisputeQueueRow, type DisputeQueueItem } from "@/components/admin/AdminQueueItem";
import { AlertIcon, CheckIcon } from "@/components/ui/Icons";
import { useFetch } from "@/hooks/useFetch";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";

// These values must match the DisputeStatus enum exactly - the API passes the
// chosen tab straight through as the status filter.
const TABS = [
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "RESOLVED_FOR_PAYER", label: "Refunded buyer" },
  { value: "RESOLVED_FOR_PAYEE", label: "Paid seller" },
  { value: "ALL", label: "All" },
];

/**
 * DisputeQueueClient
 * WHAT: Loads disputes for the chosen status and renders the rows.
 */
export function DisputeQueueClient({ counts, frozenKobo }: { counts: Record<string, number>; frozenKobo: number }) {
  const [status, setStatus] = useState("OPEN");
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading } = useFetch<{ disputes: DisputeQueueItem[] }>(`/api/admin/disputes?status=${status}&_=${reloadKey}`);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const disputes = data?.disputes ?? [];

  return (
    <div>
      {/* The frozen total - why this queue cannot be left overnight. */}
      {frozenKobo > 0 ? (
        <Card className="mb-4 border border-danger/30 bg-danger-light">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-danger-dark">
            <AlertIcon size={14} />
            Frozen right now
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-danger-dark">{formatNaira(frozenKobo)}</p>
          <p className="mt-1 text-[11px] text-danger-dark/90">
            This money belongs to nobody until you decide. Both students can see it is frozen.
          </p>
        </Card>
      ) : null}

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

      {loading && disputes.length === 0 ? (
        <ListSkeleton rows={2} />
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={<CheckIcon size={32} />}
          title={status === "OPEN" ? "No open disputes" : "Nothing here"}
          message={status === "OPEN" ? "Nothing is frozen. That is the best state for the platform to be in." : "No disputes in this state."}
        />
      ) : (
        <StaggerList gap={12} inView>
          {disputes.map((item) => (
            <DisputeQueueRow key={item.id} item={item} onChanged={refresh} />
          ))}
        </StaggerList>
      )}

      <Card className="mt-6 bg-slate-50">
        <p className="text-[11px] leading-relaxed text-slate-600">
          <strong className="text-slate-800">How to decide.</strong> Read both messages, look at any screenshots, and check
          whether the payment reference matches the deal. Resolving for the payer refunds them in full. Resolving for the payee
          releases the payout. Write your reason as if both students will read it, because they will.
        </p>
      </Card>
    </div>
  );
}
