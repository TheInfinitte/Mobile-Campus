/**
 * src/components/admin/UserAdminClient.tsx
 * WHAT: The platform-owner screen for managing accounts: search by name or
 *       phone, then suspend, lift a suspension, change a role, or save a
 *       private note.
 * WHY : Suspending a student is serious and granting admin rights is
 *       permanent-ish, so every action here goes through a confirmation
 *       dialog that states exactly what will happen. Nothing destructive
 *       happens on a single tap.
 *
 * Only SUPER_ADMIN reaches this page. The API enforces that independently,
 * so this UI being visible is never the only thing protecting the actions.
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
import { SearchIcon } from "@/components/ui/Icons";

/** One account row from the API. */
export interface AdminUserRow {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: "STUDENT" | "LANDLORD" | "ADMIN" | "SUPER_ADMIN";
  isVerified: boolean;
  verificationStatus: string;
  institution: string;
  bannedUntil: string | null;
  banReason: string | null;
  bannedBy: string | null;
  adminNote: string | null;
  createdAt: string;
}

/** Props from the server page. */
interface UserAdminClientProps {
  initialUsers: AdminUserRow[];
  /** The signed-in owner's id, so we can hide actions on their own row. */
  currentUserId: string;
}

/** What the confirmation dialog is about to do. */
type PendingAction =
  | { kind: "SUSPEND"; user: AdminUserRow }
  | { kind: "LIFT"; user: AdminUserRow }
  | { kind: "SET_ROLE"; user: AdminUserRow }
  | { kind: "NOTE"; user: AdminUserRow };

/** Human labels and colours for each role. */
const ROLE_META: Record<AdminUserRow["role"], { label: string; tone: "slate" | "primary" | "gold" }> = {
  STUDENT: { label: "Student", tone: "slate" },
  LANDLORD: { label: "Landlord", tone: "slate" },
  ADMIN: { label: "Administrator", tone: "primary" },
  SUPER_ADMIN: { label: "Platform owner", tone: "gold" },
};

/** Suspension lengths offered in the dialog, in days. 0 = permanent. */
const SUSPEND_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "Permanent" },
];

/**
 * UserAdminClient
 * WHAT: Search box + account list + action dialogs.
 */
export function UserAdminClient({ initialUsers, currentUserId }: UserAdminClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  // Dialog field values.
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [newRole, setNewRole] = useState<AdminUserRow["role"]>("STUDENT");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * search
   * WHAT: Re-fetches the list for the current search text.
   * WHY : Kept server-side so the browser never holds the whole user table -
   *       only the fifty rows the owner asked for.
   */
  async function search(text: string) {
    setQuery(text);
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(text)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed.");
      setUsers(body.data.users as AdminUserRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  /**
   * act
   * WHAT: Sends the chosen action and refreshes the row.
   */
  async function act(action: PendingAction["kind"], userId: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await sendApi<{ message: string }>("/api/admin/users", "PATCH", {
        userId,
        action,
        ...payload,
      });

      if (!res.ok || !res.data) {
        toast.error(res.error || "That action failed.");
        return;
      }

      toast.success(res.data.message);
      setPending(null);
      setReason("");
      setNote("");
      // Re-read the list so the badge and suspension state are accurate.
      await search(query);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  /** Opens the dialog for one action, pre-filling sensible defaults. */
  function open(kind: PendingAction["kind"], user: AdminUserRow) {
    setDays(7);
    setReason("");
    setNote(user.adminNote ?? "");
    setNewRole(user.role === "SUPER_ADMIN" ? "ADMIN" : "STUDENT");
    setPending({ kind, user } as PendingAction);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">User management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search by name, phone or email. Only platform owners can reach this page.
        </p>
      </div>

      {/* --- Search --- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
        className="relative"
      >
        <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, phone number or email"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-24 text-sm focus:border-primary-500 focus:outline-none"
        />
        <Button type="submit" size="sm" loading={searching} className="absolute right-1.5 top-1.5">
          Search
        </Button>
      </form>

      {/* --- Account list --- */}
      <ul className="space-y-3">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const isBanned = !!user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now();

          return (
            <li key={user.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {user.fullName}
                      {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user.phone} · {user.institution}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={ROLE_META[user.role].tone}>{ROLE_META[user.role].label}</Badge>
                    {isBanned ? <Badge tone="danger">Suspended</Badge> : <Badge tone="slate">Active</Badge>}
                  </div>
                </div>

                {/* Suspension detail, when there is one.
                    bannedUntil is decoded once here: a "permanent" suspension
                    stores JS's maximum date (year 275760), which we show as
                    "no end date" rather than a nonsense date. */}
                {isBanned && user.bannedUntil && (
                  <p className="mt-2 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger-dark">
                    {user.banReason ?? "No reason recorded."}
                    {user.bannedBy ? ` · by ${user.bannedBy}` : ""}
                    {new Date(user.bannedUntil).getFullYear() > 9999
                      ? " · no end date"
                      : ` · until ${new Date(user.bannedUntil).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}`}
                  </p>
                )}

                {/* Private note, when there is one. */}
                {user.adminNote && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold">Note:</span> {user.adminNote}
                  </p>
                )}

                {/* --- Actions. All disabled on your own row. --- */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {isBanned ? (
                    <Button variant="secondary" size="sm" disabled={busy || isSelf} onClick={() => open("LIFT", user)}>
                      Lift suspension
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={busy || isSelf} onClick={() => open("SUSPEND", user)}>
                      Suspend
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={busy || isSelf} onClick={() => open("SET_ROLE", user)}>
                    Change role
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy || isSelf} onClick={() => open("NOTE", user)}>
                    {user.adminNote ? "Edit note" : "Add note"}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {users.length === 0 && (
        <Card className="py-8 text-center">
          <p className="text-sm font-semibold text-slate-900">No accounts match that search</p>
          <p className="mt-1 text-sm text-slate-500">Try a phone number, or the first part of a name.</p>
        </Card>
      )}

      {/* --- Confirmation dialogs --- */}
      <Modal open={pending !== null} onClose={() => setPending(null)} title={dialogTitle(pending)}>
        {pending?.kind === "SUSPEND" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{pending.user.fullName}</span> will be blocked from
              signing in immediately. Their existing session stops working on the next request.
            </p>
            <div>
              <span className="text-sm font-medium text-slate-700">How long?</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SUSPEND_OPTIONS.map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    onClick={() => setDays(option.days)}
                    className={
                      days === option.days
                        ? "rounded-lg border-2 border-primary-600 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700"
                        : "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Reason (the user will see this)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="e.g. Repeatedly posting counterfeit items after two warnings."
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-primary-500 focus:outline-none"
              />
            </label>
            <div className="flex gap-2">
              <Button
                variant="danger"
                fullWidth
                loading={busy}
                disabled={!reason.trim()}
                onClick={() => act("SUSPEND", pending.user.id, { days, reason: reason.trim() })}
              >
                Suspend
              </Button>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {pending?.kind === "LIFT" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{pending.user.fullName}</span> will be able to sign in
              again straight away. The stored reason is cleared.
            </p>
            <div className="flex gap-2">
              <Button variant="primary" fullWidth loading={busy} onClick={() => act("LIFT", pending.user.id, {})}>
                Lift suspension
              </Button>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {pending?.kind === "SET_ROLE" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Changing roles takes effect on the account&apos;s next request. Currently{" "}
              <span className="font-semibold">{ROLE_META[pending.user.role].label}</span>.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_META) as AdminUserRow["role"][]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setNewRole(role)}
                  className={
                    newRole === role
                      ? "rounded-lg border-2 border-primary-600 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700"
                      : "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                  }
                >
                  {ROLE_META[role].label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                fullWidth
                loading={busy}
                disabled={newRole === pending.user.role}
                onClick={() => act("SET_ROLE", pending.user.id, { role: newRole })}
              >
                Save role
              </Button>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {pending?.kind === "NOTE" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Only staff can read this note. {pending.user.fullName} will never see it.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Repeat counterfeit seller - verified twice, warned once."
              className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-primary-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <Button variant="primary" fullWidth loading={busy} onClick={() => act("NOTE", pending.user.id, { adminNote: note.trim() })}>
                Save note
              </Button>
              <Button variant="secondary" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/**
 * dialogTitle
 * WHAT: Picks the heading for whichever dialog is open.
 * WHY : A plain function keeps the JSX above readable.
 */
function dialogTitle(pending: PendingAction | null): string {
  if (!pending) return "";
  if (pending.kind === "SUSPEND") return "Suspend this account?";
  if (pending.kind === "LIFT") return "Lift the suspension?";
  if (pending.kind === "SET_ROLE") return "Change their role?";
  return "Private note";
}
