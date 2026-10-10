/**
 * src/components/admin/GoodwillAdminClient.tsx
 * WHAT: The admin console for the goodwill board - the request ledger, every
 *       commitment with its outcome, and the list of active 7-day pauses.
 * WHY : Anonymity protects students from each other, never from moderation.
 *       Admins also review pauses, because an automated penalty must always be
 *       something a human can undo.
 *
 * There is no treasury, balance or fee panel here on purpose: the platform
 * never holds or moves anyone's money on this board.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import { sendApi } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { HeartIcon, AlertIcon } from "@/components/ui/Icons";

/** One request row. */
type AdminRequest = {
  id: string;
  alias: string;
  story: string;
  amountKobo: number;
  status: string;
  createdAt: string;
  receivedAt: string | null;
  closedAt: string | null;
  requester: { fullName: string; phone: string; isVerified: boolean; institution: { shortName: string } };
  commitments: number;
};

/** One commitment row - the audit trail of who unlocked what. */
type AdminHelp = {
  id: string;
  alias: string;
  status: string;
  committedAt: string;
  expiresAt: string;
  sentAt: string | null;
  confirmedAt: string | null;
  helper: { fullName: string; phone: string };
};

/** One active pause. */
type AdminBan = {
  userId: string;
  fullName: string;
  phone: string;
  helpsCompleted: number;
  helpsAbandoned: number;
  boardBannedUntil: string;
  banReason: string | null;
};

/** Tone per request state. */
const TONE: Record<string, "primary" | "warn" | "success" | "slate"> = {
  OPEN: "primary",
  COMMITTED: "warn",
  SENT: "warn",
  RECEIVED: "success",
  RELEASED: "slate",
  CANCELLED: "slate",
};

/**
 * GoodwillAdminClient
 * WHAT: Three sections - pauses to review, requests, commitments.
 */
export function GoodwillAdminClient() {
  const toast = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading } = useFetch<{ requests: AdminRequest[]; helps: AdminHelp[]; bans: AdminBan[] }>(
    `/api/admin/emergency${refreshKey ? `?r=${refreshKey}` : ""}`
  );

  /** Lifts a student's 7-day pause. */
  async function lift(userId: string, fullName: string) {
    setBusyId(userId);
    const result = await sendApi<{ userId: string }>(`/api/admin/emergency/${userId}`, "DELETE");
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error ?? "Could not lift the pause.");
      return;
    }
    toast.success(`${fullName} can use the support board again.`);
    setRefreshKey((key) => key + 1);
  }

  const requests = data?.requests ?? [];
  const helps = data?.helps ?? [];
  const bans = data?.bans ?? [];
  const received = requests.filter((request) => request.status === "RECEIVED").length;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ */}
      {/* PAUSES TO REVIEW                                               */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Active pauses"
          subtitle="Applied automatically when a helper unlocks private details and lets the 2-hour window expire. A human can always lift one."
        />
        {bans.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Nobody is currently paused from the board.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {bans.map((ban) => (
              <div key={ban.userId} className="rounded-xl bg-warn-light p-3">
                <p className="text-sm font-bold text-warn-dark">{ban.fullName}</p>
                <p className="mt-0.5 text-[11px] text-warn-dark/90">
                  {ban.phone} &middot; paused until {formatDate(ban.boardBannedUntil)}
                </p>
                <p className="mt-1 text-[11px] text-warn-dark/90">{ban.banReason ?? "No reason recorded."}</p>
                <p className="mt-1 text-[11px] text-warn-dark/80">
                  {ban.helpsCompleted} followed through &middot; {ban.helpsAbandoned} missed
                </p>
                <Button size="sm" className="mt-2" loading={busyId === ban.userId} onClick={() => lift(ban.userId, ban.fullName)}>
                  Lift pause
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* SUMMARY                                                        */}
      {/* ------------------------------------------------------------ */}
      <Card className="bg-slate-50">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-black text-slate-900">{requests.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Requests</p>
          </div>
          <div>
            <p className="text-lg font-black text-success-dark">{received}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Help received</p>
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">{helps.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Commitments</p>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* REQUEST LEDGER                                                 */}
      {/* ------------------------------------------------------------ */}
      {loading ? (
        <p className="px-1 py-6 text-center text-sm text-slate-500">Loading ledger...</p>
      ) : requests.length === 0 ? (
        <EmptyState icon={<HeartIcon size={32} />} title="No requests yet" message="Posts will appear here as soon as students use the board." />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {request.requester.fullName}{" "}
                    <span className="text-[11px] font-normal text-slate-400">({request.alias})</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {request.requester.phone} &middot; {request.requester.institution.shortName} &middot;{" "}
                    {formatDate(request.createdAt)}
                  </p>
                </div>
                <Badge tone={TONE[request.status] ?? "slate"}>{request.status.toLowerCase()}</Badge>
              </div>

              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">{request.story}</p>

              <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-[11px] text-slate-500">Hoping for</span>
                <span className="text-sm font-black text-primary-700">
                  <Money kobo={request.amountKobo} size="sm" />
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {request.commitments} commitment{request.commitments === 1 ? "" : "s"}
                {request.receivedAt ? ` &middot; received ${formatDate(request.receivedAt)}` : ""}
                {!request.requester.isVerified ? (
                  <span className="ml-2 inline-flex items-center gap-1 font-semibold text-warn-dark">
                    <AlertIcon size={11} /> ID not verified
                  </span>
                ) : null}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* COMMITMENT AUDIT TRAIL                                         */}
      {/* ------------------------------------------------------------ */}
      {helps.length > 0 ? (
        <Card>
          <CardHeader title="Commitment trail" subtitle="Who unlocked a classmate's details, and what happened next." />
          <div className="mt-3 space-y-2">
            {helps.map((help) => (
              <div key={help.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-800">
                  {help.helper.fullName} <span className="font-normal text-slate-500">({help.helper.phone})</span>
                  <span className="ml-1 text-slate-400">&rarr; {help.alias}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {help.status === "COMMITTED" && "Details unlocked - transfer window running"}
                  {help.status === "SENT" && "Marked funds as sent"}
                  {help.status === "RECEIVED" && "Confirmed by the recipient"}
                  {help.status === "RELEASED" && "Did not follow through / released"}
                  <span className="ml-1">&middot; {formatDate(help.committedAt)}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
