/**
 * src/components/emergency/GoodwillClient.tsx
 * WHAT: The "Urgent 2k" peer-to-peer goodwill board - post an anonymous
 *       request for help, or help a classmate through the commitment gate,
 *       the 2-hour transfer timer, and the two-way confirmation loop.
 * WHY : Nobody is ever lent money here and nobody owes anything. One student
 *       asks, another chooses to give, the money moves between their own bank
 *       apps, and the platform only protects identity and dignity.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState } from "@/components/ui/Card";
import { Input, Select, TextArea, Checkbox } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import { useSession } from "@/components/layout/Shell";
import { sendApi } from "@/lib/api-client";
import { formatDate, timeAgo } from "@/lib/utils";
import { HeartIcon, ShieldIcon, AlertIcon, ClockIcon, LockIcon, CheckIcon, CopyIcon } from "@/components/ui/Icons";

/** Nigerian banks students actually use. */
const BANKS = ["Access Bank", "GTBank", "First Bank", "Zenith Bank", "UBA", "Fidelity Bank", "Opay", "PalmPay", "Kuda MFB", "Moniepoint MFB"];

/** The transfer window, in minutes - must match COMMIT_WINDOW_MINUTES. */
const WINDOW_MINUTES = 120;

/** One commitment on one of my requests. */
type HelpView = {
  id: string;
  status: "COMMITTED" | "SENT" | "RECEIVED" | "RELEASED";
  expiresAt: string;
  sentAt: string | null;
  confirmedAt: string | null;
  note: string | null;
  isMine: boolean;
};

/** One of my own requests. */
type MyRequest = {
  id: string;
  alias: string;
  story: string;
  amountKobo: number;
  status: "OPEN" | "COMMITTED" | "SENT" | "RECEIVED" | "RELEASED" | "CANCELLED";
  activeHelpId: string | null;
  receivedAt: string | null;
  createdAt: string;
  helps: Array<HelpView & { helper: { fullName: string; avatarUrl: string | null } }>;
};

/** One card on the anonymous board. */
type BoardRequest = {
  id: string;
  alias: string;
  story: string;
  amountKobo: number;
  createdAt: string;
  isMine: boolean;
};

/** My live commitment as the board API returns it. */
type MyCommitment = {
  id: string;
  requestId: string;
  status: "COMMITTED" | "SENT";
  expiresAt: string;
  request: { alias: string; story: string; amountKobo: number; bankName: string };
};

/** The revealed details a committed helper is allowed to see. */
type Reveal = {
  fullName: string;
  level: string | null;
  department: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

type RecordView = {
  helpsCompleted: number;
  helpsAbandoned: number;
  requestsReceived: number;
  boardBannedUntil: string | null;
  banReason: string | null;
};

/** Label + tone for each request state. */
const STATE: Record<MyRequest["status"], { tone: "primary" | "warn" | "success" | "slate"; label: string }> = {
  OPEN: { tone: "primary", label: "On the board" },
  COMMITTED: { tone: "warn", label: "Someone is on it" },
  SENT: { tone: "warn", label: "Waiting for you to confirm" },
  RECEIVED: { tone: "success", label: "Received - thank you" },
  RELEASED: { tone: "slate", label: "Released" },
  CANCELLED: { tone: "slate", label: "Withdrawn" },
};

/**
 * GoodwillClient
 * WHAT: Two tabs - my own request, and the anonymous board I can help on.
 */
export function GoodwillClient() {
  const { user } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<"mine" | "board">("mine");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: mineData, loading: loadingMine } = useFetch<{ requests: MyRequest[]; record: RecordView; canUseBoard: boolean }>(
    `/api/emergency${refreshKey ? `?r=${refreshKey}` : ""}`
  );
  const { data: boardData, loading: loadingBoard } = useFetch<{
    requests: BoardRequest[];
    myCommitments: MyCommitment[];
    boardBannedUntil: string | null;
  }>(`/api/emergency/board${refreshKey ? `?r=${refreshKey}` : ""}`);

  const record = mineData?.record;
  const requests = mineData?.requests ?? [];
  const board = boardData?.requests ?? [];
  const commitments = boardData?.myCommitments ?? [];
  const bannedUntil = record?.boardBannedUntil ?? null;
  const hasLiveRequest = requests.some((request) => ["OPEN", "COMMITTED", "SENT"].includes(request.status));
  const canUse = user?.isVerified === true && !bannedUntil;

  /** Refreshes both lists. */
  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  // A helper with a live commitment lands on the board tab, because that is
  // where their timer and the "I have sent" button live.
  useEffect(() => {
    if (commitments.length > 0) setTab("board");
  }, [commitments.length]);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ */}
      {/* WHAT THIS IS - and what it is not.                             */}
      {/* ------------------------------------------------------------ */}
      <Card className="border border-primary-200 bg-primary-50/70">
        <CardHeader
          title="Urgent 2k"
          subtitle="Students helping students. No loans, no interest, no fees, and nothing to repay."
        />
        <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-primary-900">
          <p className="flex items-start gap-2">
            <HeartIcon size={14} className="mt-px shrink-0" />
            If you need help, post anonymously. Classmates see your situation, never your name.
          </p>
          <p className="flex items-start gap-2">
            <ShieldIcon size={14} className="mt-px shrink-0" />
            Money goes straight from a helper&rsquo;s bank app to yours. The platform never holds it.
          </p>
          <p className="flex items-start gap-2">
            <LockIcon size={14} className="mt-px shrink-0" />
            A helper who unlocks your details must send within 2 hours, or they lose board access for 7 days.
          </p>
        </div>
      </Card>

      {/* The 7-day pause, explained honestly and privately. */}
      {bannedUntil ? (
        <Card className="border border-warn/40 bg-warn-light">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-warn-dark">
            <AlertIcon size={16} className="mt-px shrink-0" />
            <span>
              <strong>Support board paused until {formatDate(bannedUntil)}.</strong>{" "}
              {record?.banReason ?? "You unlocked a classmate's private details and the transfer window expired."} The
              rest of Mobile Campus works as normal. If the transfer did go through, tell an admin and they will
              review it.
            </span>
          </p>
        </Card>
      ) : null}

      {/* Verification gate. */}
      {user && !user.isVerified ? (
        <Card className="border border-warn/40 bg-warn-light">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-warn-dark">
            <ShieldIcon size={16} className="mt-px shrink-0" />
            The support board requires a verified student ID. Upload yours on the verification page - it usually takes
            a few hours on a weekday.
          </p>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* TABS                                                           */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Support board sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mine"}
          onClick={() => setTab("mine")}
          className={`min-h-11 rounded-lg text-xs font-bold transition-colors ${tab === "mine" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"}`}
        >
          My request
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "board"}
          onClick={() => setTab("board")}
          className={`min-h-11 rounded-lg text-xs font-bold transition-colors ${tab === "board" ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"}`}
        >
          Help a classmate {board.length > 0 ? `(${board.length})` : ""}
          {commitments.length > 0 ? <span className="ml-1 text-gold-700">&bull;</span> : null}
        </button>
      </div>

      {tab === "mine" ? (
        <>
          {canUse && !hasLiveRequest ? <RequestForm onDone={refresh} /> : null}

          {loadingMine ? (
            <p className="px-1 py-6 text-center text-sm text-slate-500">Loading...</p>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<HeartIcon size={32} />}
              title="No requests yet"
              message="If something urgent comes up - transport home, a medical top-up, a lab manual - you can ask your campus anonymously. Nobody is ever obliged to give, and nothing is ever owed back."
            />
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <MyRequestCard key={request.id} request={request} onChanged={refresh} />
              ))}
            </div>
          )}

          {/* Private goodwill record. */}
          {record ? (
            <Card className="bg-slate-50">
              <CardHeader title="Your goodwill record" subtitle="Private - only you and admins can see this." />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-black text-success-dark">{record.helpsCompleted}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Followed through</p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-700">{record.requestsReceived}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Help received</p>
                </div>
                <div>
                  <p className="text-lg font-black text-slate-700">{record.helpsAbandoned}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Missed commitments</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Following through on help you committed to is what earns a goodwill badge. Asking for help never counts
                against you - not once, not ever.
              </p>
            </Card>
          ) : null}
        </>
      ) : (
        <>
          {/* A live commitment always sits at the top of the board tab. */}
          {commitments.map((commitment) => (
            <ActiveCommitment key={commitment.id} commitment={commitment} onChanged={refresh} />
          ))}

          {loadingBoard ? (
            <p className="px-1 py-6 text-center text-sm text-slate-500">Loading the board...</p>
          ) : board.length === 0 ? (
            <EmptyState
              icon={<HeartIcon size={32} />}
              title="Nobody needs help right now"
              message="When a classmate posts an urgent request it appears here anonymously. Helping is entirely voluntary and the money goes straight from your bank to theirs."
            />
          ) : (
            <div className="space-y-3">
              {board.map((request) => (
                <BoardCard key={request.id} request={request} canHelp={canUse === true} onHelped={refresh} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * RequestForm
 * WHAT: Post an anonymous request, with the ID name-match rule explained
 *       before submit (the server enforces it regardless).
 */
function RequestForm({ onDone }: { onDone: () => void }) {
  const { user } = useSession();
  const toast = useToast();

  const [amount, setAmount] = useState("");
  const [story, setStory] = useState("");
  const [bankName, setBankName] = useState(BANKS[0]);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState(user?.fullName ?? "");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!consent) {
      setError("Please accept the board rules.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await sendApi<{ id: string; alias: string }>("/api/emergency", "POST", {
      amountKobo: Math.round(Number(amount.replace(/[^\d.]/g, "")) * 100),
      story: story.trim(),
      bankName,
      bankAccountNumber: accountNumber.trim(),
      bankAccountName: accountName.trim(),
      consent: true,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not post your request.");
      return;
    }
    toast.success(`Posted anonymously as ${result.data?.alias}. Your name is not shown to anyone.`);
    setAmount("");
    setStory("");
    onDone();
  }

  return (
    <Card>
      <CardHeader title="Ask for help" subtitle="Posted anonymously. No repayment, no interest, no obligation." />
      <form onSubmit={submit} className="mt-3 space-y-3">
        <Input
          label="How much are you hoping to raise? (₦)"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="numeric"
          placeholder="2000"
          hint="A hope, not a debt. Helpers give what they can."
          required
        />
        <TextArea
          label="What is going on?"
          value={story}
          onChange={(event) => setStory(event.target.value)}
          rows={4}
          placeholder="Explain the situation in your own words. This is what classmates will read - your name is never attached to it."
          required
        />

        <Select label="Your bank" value={bankName} onChange={(event) => setBankName(event.target.value)} options={BANKS.map((bank) => ({ value: bank, label: bank }))} />
        <Input
          label="10-digit account number"
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value)}
          inputMode="numeric"
          placeholder="0123456789"
          maxLength={10}
          required
        />
        <Input
          label="Account name"
          value={accountName}
          onChange={(event) => setAccountName(event.target.value)}
          hint="Must match the legal name on your student ID exactly - third-party accounts are rejected automatically."
          required
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Checkbox
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            label="I understand the board rules"
            description="This is a gift between students, not a loan - nothing is owed back. My bank details are shown only to a classmate who has accepted the commitment notice, and I will confirm once the money lands."
          />
        </div>

        {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}
        <Button type="submit" fullWidth loading={saving}>
          <HeartIcon size={16} /> Post anonymously
        </Button>
        <p className="flex items-start gap-2 px-2 text-[11px] leading-relaxed text-slate-400">
          <LockIcon size={13} className="mt-px shrink-0" />
          Your bank details are encrypted at rest and revealed to nobody until a classmate accepts the commitment
          notice.
        </p>
      </form>
    </Card>
  );
}

/**
 * MyRequestCard
 * WHAT: One of my requests with its state, the helpers involved, and the
 *       "Confirm funds received" button that closes the loop.
 */
function MyRequestCard({ request, onChanged }: { request: MyRequest; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const state = STATE[request.status];
  // The commitment currently waiting on my confirmation.
  const awaiting = request.helps.find((help) => help.status === "SENT");
  const active = request.helps.find((help) => help.status === "COMMITTED");

  /** Confirms the money landed - the only thing that credits the helper. */
  async function confirm(helpId: string) {
    setBusy(true);
    const result = await sendApi<{ status: string }>(`/api/emergency/${helpId}/confirm`, "POST");
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not confirm receipt.");
      return;
    }
    toast.success("Confirmed. Thank you - your helper gets a goodwill badge for following through.");
    onChanged();
  }

  /** Releases the current helper with no penalty to them. */
  async function release() {
    setBusy(true);
    const result = await sendApi<{ status: string }>(`/api/emergency/${request.id}/release`, "POST");
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not release them.");
      return;
    }
    toast.success("Released - your request is back on the board. Nothing counts against them.");
    onChanged();
  }

  /** Withdraws the request entirely. */
  async function withdraw() {
    setBusy(true);
    const result = await sendApi<{ status: string }>(`/api/emergency/${request.id}`, "DELETE");
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not withdraw.");
      return;
    }
    toast.success("Withdrawn. Your details are no longer visible to anyone.");
    onChanged();
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">
            <Money kobo={request.amountKobo} size="sm" /> hoped
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Shown as {request.alias} &middot; posted {timeAgo(request.createdAt)}
          </p>
        </div>
        <Badge tone={state.tone}>{state.label}</Badge>
      </div>

      <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">{request.story}</p>

      {/* The people who stepped up, newest first. */}
      {request.helps.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {request.helps.map((help) => (
            <div key={help.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="min-w-0 truncate text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800">{help.helper.fullName}</span>{" "}
                {help.status === "COMMITTED" && <span>committed - sending now</span>}
                {help.status === "SENT" && <span className="font-semibold text-success-dark">says funds sent</span>}
                {help.status === "RECEIVED" && <span className="text-success-dark">confirmed &middot; thank you</span>}
                {help.status === "RELEASED" && <span className="text-slate-400">released</span>}
              </span>
              {help.note ? <span className="shrink-0 text-[10px] italic text-slate-400">&ldquo;{help.note}&rdquo;</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* THE RECIPIENT'S HALF OF THE LOOP. */}
      {awaiting ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-success-light p-3 text-[11px] leading-relaxed text-success-dark">
            {awaiting.helper.fullName} says the money has been sent. Check your bank app, then confirm below - it is
            the only way they earn their goodwill badge.
          </p>
          <Button fullWidth loading={busy} onClick={() => confirm(awaiting.id)}>
            <CheckIcon size={16} /> Confirm funds received
          </Button>
        </div>
      ) : null}

      {/* Compassion in both directions: let a helper out, or withdraw. */}
      {active ? (
        <Button className="mt-2" variant="ghost" fullWidth loading={busy} onClick={release}>
          Let {active.helper.fullName} off the hook
        </Button>
      ) : null}
      {["OPEN", "COMMITTED", "SENT"].includes(request.status) ? (
        <Button className="mt-2" variant="ghost" fullWidth loading={busy} onClick={withdraw}>
          Withdraw my request
        </Button>
      ) : null}
    </Card>
  );
}

/**
 * useCountdown
 * WHAT: A live mm:ss string counting down to a deadline.
 * WHY : The 2-hour window is the whole privacy guarantee, so the helper must
 *       be able to see exactly how much of it is left.
 */
function useCountdown(expiresAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  if (!expiresAt) return "";
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * BoardCard
 * WHAT: One anonymous request, with the "I want to help" button that opens
 *       the commitment gate.
 */
function BoardCard({ request, canHelp, onHelped }: { request: BoardRequest; canHelp: boolean; onHelped: () => void }) {
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{request.alias}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(request.createdAt)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-black text-primary-700">
              <Money kobo={request.amountKobo} size="sm" />
            </p>
            <p className="text-[10px] text-slate-400">hoping for</p>
          </div>
        </div>

        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">{request.story}</p>

        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-400">
          <LockIcon size={12} className="mt-px shrink-0" />
          Name and bank details stay hidden until you accept the commitment notice.
        </p>

        {request.isMine ? (
          <p className="mt-3 rounded-xl bg-primary-50 p-2.5 text-center text-[11px] font-semibold text-primary-700">
            This is your own request.
          </p>
        ) : (
          <Button className="mt-3" fullWidth disabled={!canHelp} onClick={() => setGateOpen(true)}>
            <HeartIcon size={16} /> I want to help
          </Button>
        )}
      </Card>

      <CommitmentGate open={gateOpen} onClose={() => setGateOpen(false)} request={request} onCommitted={onHelped} />
    </>
  );
}

/**
 * CommitmentGate
 * WHAT: THE WARNING GATE MODAL. Mandatory, explicit, and the only thing that
 *       unlocks a classmate's identity and bank details.
 * WHY : Reading someone's bank details without intending to send is a privacy
 *       violation. The consequences are stated before the click, not after.
 */
function CommitmentGate({
  open,
  onClose,
  request,
  onCommitted,
}: {
  open: boolean;
  onClose: () => void;
  request: BoardRequest;
  onCommitted: () => void;
}) {
  const toast = useToast();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const countdown = useCountdown(expiresAt);

  /** Accepts the notice and unlocks the details. */
  async function proceed() {
    setSaving(true);
    const result = await sendApi<{ reveal: Reveal; expiresAt: string }>(`/api/emergency/${request.id}/commit`, "POST", {
      accept: true,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      toast.error(result.error ?? "Could not unlock the details.");
      return;
    }
    setReveal(result.data.reveal);
    setExpiresAt(result.data.expiresAt);
    toast.success("Details unlocked. The 2-hour window has started.");
    onCommitted();
  }

  /** Closes and resets, so the gate is never left half-accepted. */
  function close() {
    setAccepted(false);
    setReveal(null);
    setExpiresAt(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={reveal ? "Transfer details" : "Commitment notice"}>
      {reveal ? (
        <RevealPanel reveal={reveal} countdown={countdown} onClose={close} />
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-warn/40 bg-warn-light p-3">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-warn-dark">
              <AlertIcon size={16} className="mt-px shrink-0" />
              <span>
                <strong>Commitment notice.</strong> Clicking &ldquo;Proceed&rdquo; will reveal this student&rsquo;s
                verified identity and direct bank details so you can send support. If you reveal these details and fail
                to complete the transfer or ghost the request, your account will face a{" "}
                <strong>7-day platform suspension</strong> from the support board to protect user privacy.
              </span>
            </p>
          </div>

          <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-600">
            <li>&bull; You will have {WINDOW_MINUTES / 60} hours to send from your own bank app.</li>
            <li>&bull; The platform never touches the money and takes no fee.</li>
            <li>&bull; Nothing is owed back - this is a gift, not a loan.</li>
            <li>&bull; If you cannot send, say so straight away so they are not left waiting.</li>
          </ul>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Checkbox
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              label="I understand, and I intend to send"
              description="I will send within 2 hours or tell them immediately if I cannot."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={close}>
              Back
            </Button>
            <Button disabled={!accepted} loading={saving} onClick={proceed}>
              Proceed
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * RevealPanel
 * WHAT: The unlocked details plus the live countdown and the copy button.
 * WHY : The helper needs to open their bank app and type an account number
 *       without mis-reading it, under a real clock.
 */
function RevealPanel({ reveal, countdown, onClose }: { reveal: Reveal; countdown: string; onClose: () => void }) {
  const toast = useToast();

  /** Copies the account number so it cannot be mistyped. */
  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(reveal.accountNumber);
      toast.success("Account number copied.");
    } catch {
      toast.error("Could not copy - please type it carefully instead.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-danger-light p-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-danger-dark">Transfer window</p>
        <p className="font-mono text-2xl font-black text-danger-dark">{countdown}</p>
        <p className="mt-0.5 text-[10px] text-danger-dark">Send now, then mark it as sent below.</p>
      </div>

      <div className="space-y-2 rounded-xl bg-slate-50 p-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Verified student</p>
          <p className="text-sm font-bold text-slate-900">{reveal.fullName}</p>
          <p className="text-[11px] text-slate-500">
            {[reveal.level, reveal.department].filter(Boolean).join(" · ") || "Student"}
          </p>
        </div>
        <div className="border-t border-slate-200 pt-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Bank</p>
          <p className="text-sm font-bold text-slate-900">{reveal.bankName}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Account number</p>
          <p className="font-mono text-base font-black tracking-wide text-slate-900">{reveal.accountNumber}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Account name</p>
          <p className="text-sm font-bold text-slate-900">{reveal.accountName}</p>
        </div>
      </div>

      <p className="rounded-xl bg-primary-50 p-3 text-[11px] leading-relaxed text-primary-900">
        The account name above was checked against this student&rsquo;s verified ID card, so you know exactly who you
        are sending to. This is a gift - nothing is owed back.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={copyAccount}>
          <CopyIcon size={16} /> Copy account
        </Button>
        <Button onClick={onClose}>Go to my bank app</Button>
      </div>
    </div>
  );
}

/**
 * ActiveCommitment
 * WHAT: The helper's live panel - countdown, revealed details, and the
 *       "I have sent the funds" button.
 * WHY : This is the helper's half of the two-way loop, and the thing that
 *       stops the snooper timer.
 */
function ActiveCommitment({ commitment, onChanged }: { commitment: MyCommitment; onChanged: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const countdown = useCountdown(commitment.expiresAt);

  // Re-read the revealed details so a refresh never loses the account number.
  // This is a GET: re-reading never restarts the transfer timer.
  const { data: revealData } = useFetch<{ reveal: Reveal }>(`/api/emergency/${commitment.requestId}/commit`);
  const reveal = revealData?.reveal ?? null;

  const sent = commitment.status === "SENT";

  /** Marks the transfer as done from the helper's own bank app. */
  async function markSent() {
    setBusy(true);
    const result = await sendApi<{ status: string }>(`/api/emergency/${commitment.id}/sent`, "POST", {
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not mark it as sent.");
      return;
    }
    toast.success("Marked as sent. They will confirm once it lands.");
    onChanged();
  }

  return (
    <Card className={sent ? "border border-success/30 bg-success-light/40" : "border border-gold-300 bg-gold-50"}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">{commitment.request.alias}</p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{commitment.request.story}</p>
        </div>
        <Badge tone={sent ? "success" : "warn"}>{sent ? "Waiting for their confirmation" : "Sending"}</Badge>
      </div>

      <div className={`mt-3 rounded-xl p-3 text-center ${sent ? "bg-white" : "bg-danger-light"}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${sent ? "text-slate-400" : "text-danger-dark"}`}>
          {sent ? "Window closed - you did your part" : "Transfer window"}
        </p>
        <p className={`font-mono text-2xl font-black ${sent ? "text-slate-400" : "text-danger-dark"}`}>{countdown}</p>
      </div>

      {/* Revealed details, collapsible so a shoulder-surf cannot read them. */}
      {reveal ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-bold text-slate-700"
          >
            {showDetails ? "Hide their bank details" : "Show their bank details"}
          </button>
          {showDetails ? (
            <div className="mt-2 space-y-1.5 rounded-xl bg-white p-3 text-[11px]">
              <p>
                <span className="font-semibold text-slate-500">Student:</span>{" "}
                <span className="font-bold text-slate-900">{reveal.fullName}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Bank:</span>{" "}
                <span className="font-bold text-slate-900">{reveal.bankName}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Account:</span>{" "}
                <span className="font-mono font-black text-slate-900">{reveal.accountNumber}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Name:</span>{" "}
                <span className="font-bold text-slate-900">{reveal.accountName}</span>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!sent ? (
        <div className="mt-3 space-y-2">
          <Input
            label="Note for them (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Sent from my GTB account"
            maxLength={200}
          />
          <Button fullWidth loading={busy} onClick={markSent}>
            <CheckIcon size={16} /> I have sent the funds
          </Button>
          <p className="text-center text-[10px] leading-relaxed text-slate-500">
            Only click this once the money has actually left your bank app. If you cannot send, tell them straight away
            so they are not left waiting - letting the window run out costs you 7 days of board access.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-600">
          You have done your part. They will confirm once the money lands, and that is what earns your goodwill badge.
        </p>
      )}
    </Card>
  );
}
