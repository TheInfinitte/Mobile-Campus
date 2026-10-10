/**
 * src/components/admin/ModerationClient.tsx
 * WHAT: The content moderation screen. Lists everything waiting for an admin
 *       (market items, gigs, rooms) with four actions on each row:
 *       flag, hide, restore and delete.
 * WHY : Admins work from a phone as often as a desk, so this is a single
 *       scrolling list with big touch targets rather than a data table.
 *
 * The point of the "note" prompt before hiding: the note is sent to the
 * student verbatim. Forcing the admin to write it at the moment of action
 * means nobody gets a silent, unexplained removal.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendApi } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { AlertIcon, CheckIcon, CloseIcon, EyeIcon, TrashIcon } from "@/components/ui/Icons";

/** One row from the moderation queue. */
export interface ModerationRow {
  type: "MARKET_ITEM" | "GIG" | "LODGE";
  id: string;
  title: string;
  status: string;
  owner: { id: string; fullName: string; phone: string };
  openReports: number;
  updatedAt: string;
}

/** Props passed down from the server page. */
interface ModerationClientProps {
  initialRows: ModerationRow[];
  counts: { MARKET_ITEM: number; GIG: number; LODGE: number };
  openReports: number;
}

/** Human labels for the three content types. */
const TYPE_LABELS: Record<ModerationRow["type"], string> = {
  MARKET_ITEM: "Market item",
  GIG: "Gig post",
  LODGE: "Room listing",
};

/**
 * ModerationClient
 * WHAT: Renders the queue and handles the four moderation actions.
 */
export function ModerationClient({ initialRows, counts, openReports }: ModerationClientProps) {
  const router = useRouter();
  const toast = useToast();

  // Local copy of the rows so an action can remove one instantly without
  // waiting for a full refetch.
  const [rows, setRows] = useState<ModerationRow[]>(initialRows);
  // Which row's confirmation dialog is open, and what we are about to do.
  const [pending, setPending] = useState<{ row: ModerationRow; action: "FLAG" | "HIDE" | "DELETE" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * runAction
   * WHAT: Sends the moderation request and updates the list.
   * WHY : One function for all four actions keeps the loading state, toast and
   *       list update identical whichever button was pressed.
   */
  async function runAction(row: ModerationRow, action: "FLAG" | "HIDE" | "RESTORE" | "DELETE", noteText?: string) {
    setBusy(true);
    try {
      // The route returns the updated row; typing it here keeps res.data safe
      // to read below.
      const res = await sendApi<{ status: string; message?: string }>("/api/admin/moderation", "PATCH", {
        type: row.type,
        id: row.id,
        action,
        ...(noteText ? { note: noteText } : {}),
      });

      // sendApi resolves even on a 4xx/5xx, so the ok flag is the real check.
      // Without it a failed request would look like a success and we would
      // update the list to match a change that never happened.
      if (!res.ok || !res.data) {
        toast.error(res.error || "That action failed.");
        return;
      }

      // DELETE removes the row; the others move it to a new status, so we keep
      // it visible with the updated badge - the admin often works down a list.
      if (action === "DELETE") {
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } else {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: res.data!.status } : r)),
        );
      }

      toast.success(`Done - ${action.toLowerCase()} applied.`);
      // The sidebar badge counts come from the server, so refresh them.
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That action failed.");
    } finally {
      setBusy(false);
      setPending(null);
      setNote("");
    }
  }

  /** Opens the note prompt. Flag and hide both need a reason. */
  function askForNote(row: ModerationRow, action: "FLAG" | "HIDE" | "DELETE") {
    setPending({ row, action });
    setNote("");
  }

  return (
    <div className="space-y-4">
      {/* --- Header with counts --- */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Content moderation</h1>
        <p className="mt-1 text-sm text-slate-500">
          {rows.length} item{rows.length === 1 ? "" : "s"} waiting · {openReports} open report
          {openReports === 1 ? "" : "s"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="slate">{counts.MARKET_ITEM} market</Badge>
          <Badge tone="slate">{counts.GIG} gigs</Badge>
          <Badge tone="slate">{counts.LODGE} rooms</Badge>
        </div>
      </div>

      {/* --- Empty state --- */}
      {rows.length === 0 && (
        <Card className="text-center py-8">
          <CheckIcon size={28} className="mx-auto text-success" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Nothing needs moderation</p>
          <p className="mt-1 text-sm text-slate-500">
            Flagged or hidden items will appear here. Students can also report content, which
            shows up in the scam reports queue.
          </p>
        </Card>
      )}

      {/* --- The queue --- */}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={`${row.type}-${row.id}`}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {TYPE_LABELS[row.type]} · {row.owner.fullName} · {row.owner.phone}
                  </p>
                </div>
                <Badge tone={row.status === "HIDDEN" || row.status === "REMOVED" ? "danger" : "warn"}>
                  {row.status.replace("_", " ")}
                </Badge>
              </div>

              {/* How many students reported this. Drives urgency. */}
              {row.openReports > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
                  <AlertIcon size={14} />
                  {row.openReports} open report{row.openReports === 1 ? "" : "s"} against this
                </p>
              )}

              {/* --- Actions --- */}
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Flag: mark for review, stays visible. */}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => askForNote(row, "FLAG")}
                  icon={<EyeIcon size={14} />}
                >
                  Flag
                </Button>

                {/* Hide: pull it off the student board. */}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || row.status === "HIDDEN" || row.status === "REMOVED"}
                  onClick={() => askForNote(row, "HIDE")}
                  icon={<CloseIcon size={14} />}
                >
                  Hide
                </Button>

                {/* Restore: put it back. No note needed. */}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => runAction(row, "RESTORE")}
                  icon={<CheckIcon size={14} />}
                >
                  Restore
                </Button>

                {/* Delete: permanent. Red, and always asks first. */}
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => askForNote(row, "DELETE")}
                  icon={<TrashIcon size={14} />}
                >
                  Delete
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* --- Confirmation dialog with the reason field --- */}
      <Modal
        open={pending !== null}
        onClose={() => {
          setPending(null);
          setNote("");
        }}
        title={
          pending
            ? pending.action === "DELETE"
              ? "Delete permanently?"
              : pending.action === "HIDE"
                ? "Hide from students?"
                : "Flag for review?"
            : ""
        }
      >
        {pending && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{pending.row.title}</span> by{" "}
              {pending.row.owner.fullName}
            </p>

            {/* The note is sent to the owner, so this is the moment to be fair. */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Reason {pending.action === "DELETE" ? "(optional)" : "(the owner will see this)"}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={
                  pending.action === "HIDE"
                    ? "e.g. Photo does not match the description. Re-upload a clear photo and we will put it back."
                    : "e.g. Price looks too good to be true - checking with the seller."
                }
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-primary-500 focus:outline-none"
              />
            </label>

            <div className="flex gap-2">
              <Button
                variant={pending.action === "DELETE" ? "danger" : "primary"}
                fullWidth
                loading={busy}
                onClick={() => runAction(pending.row, pending.action, note.trim() || undefined)}
              >
                {pending.action === "DELETE"
                  ? "Delete it"
                  : pending.action === "HIDE"
                    ? "Hide it"
                    : "Flag it"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPending(null);
                  setNote("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
