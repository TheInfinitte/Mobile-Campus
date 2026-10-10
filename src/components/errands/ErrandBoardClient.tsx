/**
 * src/components/errands/ErrandBoardClient.tsx
 * WHAT: The errands task board - strictly NON-FOOD campus logistics. Posters
 *       set pickup, drop-off and fee; moving students claim and fulfil.
 * WHY : Document drops, marketplace handovers and hostel key runs happen
 *       every day and currently run on noisy WhatsApp groups. A structured
 *       board with a claim flow makes them trackable.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Input, TextArea, Select, Checkbox } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import { useSession } from "@/components/layout/Shell";
import { sendApi } from "@/lib/api-client";
import { timeAgo, whatsappLink, cn } from "@/lib/utils";
import { formatNaira } from "@/lib/money";
import { ERRAND_CATEGORIES } from "@/lib/data";
import {
  PinIcon,
  ArrowRightIcon,
  ClockIcon,
  PlusIcon,
  TaskIcon,
  WhatsAppIcon,
} from "@/components/ui/Icons";

/** One errand as the board API returns it. */
type ErrandView = {
  id: string;
  title: string;
  description: string;
  category: string;
  pickupPoint: string;
  dropOffPoint: string;
  feeKobo: number;
  isNegotiable: boolean;
  dueAt: string | null;
  status: string;
  isSponsored: boolean;
  createdAt: string;
  poster: { id: string; fullName: string; isVerified: boolean; avatarUrl: string | null };
};

/**
 * ErrandBoardClient
 * WHAT: Category chips, the open-task list, the claim/complete actions, and
 *       the post-errand modal.
 */
export function ErrandBoardClient() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();

  const [category, setCategory] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [postOpen, setPostOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const url = `/api/errands${category ? `?category=${encodeURIComponent(category)}` : ""}${refreshKey ? `${category ? "&" : "?"}r=${refreshKey}` : ""}`;
  const { data, loading } = useFetch<{ errands: ErrandView[]; total: number }>(url);
  const errands = data?.errands ?? [];

  /** Refreshes the list after any change. */
  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  /**
   * claim
   * WHAT: The mover takes the task. Contacts unlock for both sides after.
   */
  async function claim(errand: ErrandView) {
    setBusyId(errand.id);
    const result = await sendApi<{ status: string }>(`/api/errands/${errand.id}`, "PATCH", { action: "CLAIM" });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error ?? "Could not claim the errand.");
      return;
    }
    toast.success("Claimed! The poster's contact details are now on the task.");
    refresh();
  }

  const canPost = user?.role === "STUDENT";

  return (
    <div>
      {/* ------------------------------------------------------------ */}
      {/* CATEGORY CHIPS + POST BUTTON                                   */}
      {/* ------------------------------------------------------------ */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`mc-chip shrink-0 ${!category ? "border-primary-600 bg-primary-600 text-white" : ""}`}
          >
            All
          </button>
          {ERRAND_CATEGORIES.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setCategory(chip)}
              className={`mc-chip shrink-0 ${category === chip ? "border-primary-600 bg-primary-600 text-white" : ""}`}
            >
              {chip}
            </button>
          ))}
        </div>
        {canPost ? (
          <Button size="sm" onClick={() => setPostOpen(true)} className="shrink-0">
            <PlusIcon size={14} /> Post
          </Button>
        ) : null}
      </div>

      {/* Non-food rule, stated plainly. */}
      <p className="mb-3 rounded-xl bg-gold-50 p-3 text-[11px] leading-relaxed text-gold-800">
        <strong>Non-food tasks only.</strong> Food orders live in the{" "}
        <Link href="/food" className="font-bold underline">
          Food Directory
        </Link>{" "}
        - a cold plate of rice is nobody&apos;s errand.
      </p>

      {/* ------------------------------------------------------------ */}
      {/* THE BOARD                                                      */}
      {/* ------------------------------------------------------------ */}
      {loading ? (
        <p className="px-1 py-8 text-center text-sm text-slate-500">Loading errands...</p>
      ) : errands.length === 0 ? (
        <EmptyState
          icon={<TaskIcon size={32} />}
          title="No open errands right now"
          message="Need a document dropped at a department block or a marketplace pickup handed over? Post it here - a student heading that way will claim it."
          action={
            canPost ? (
              <Button onClick={() => setPostOpen(true)}>
                <PlusIcon size={16} /> Post an errand
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {errands.map((errand) => (
            <Card key={errand.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="line-clamp-1 text-sm font-bold text-slate-900">{errand.title}</h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                    <Badge tone="outline">{errand.category}</Badge>
                    {errand.isSponsored ? <Badge tone="gold">Promoted</Badge> : null}
                    <span>{timeAgo(errand.createdAt)}</span>
                  </p>
                </div>
                {/* The fee pill - what the mover earns. */}
                <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 py-2">
                  <span className="text-sm font-black text-primary-700">{formatNaira(errand.feeKobo)}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-primary-500">fee</span>
                </div>
              </div>

              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{errand.description}</p>

              {/* The logistics triple: pickup -> drop-off, plus deadline. */}
              <div className="mt-2.5 space-y-1 rounded-xl bg-slate-50 p-2.5">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                  <PinIcon size={12} className="shrink-0 text-slate-400" /> {errand.pickupPoint}
                </p>
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                  <ArrowRightIcon size={12} className="shrink-0 text-primary-500" /> {errand.dropOffPoint}
                </p>
                {errand.dueAt ? (
                  <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <ClockIcon size={12} className="shrink-0" /> Needed by {new Date(errand.dueAt).toLocaleString("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                ) : null}
                {errand.isNegotiable ? (
                  <p className="text-[11px] font-semibold text-primary-700">Fee negotiable</p>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] text-slate-500">
                  Posted by <span className="font-semibold text-slate-700">{errand.poster.fullName}</span>
                  {errand.poster.isVerified ? <span className="ml-1 text-success-dark">✓ verified</span> : null}
                </p>
                {/* CLAIM FLOW: any verified student who is not the poster. */}
                {user && errand.poster.id !== user.id ? (
                  <Button size="sm" onClick={() => claim(errand)} loading={busyId === errand.id} disabled={busyId !== null}>
                    Claim task
                  </Button>
                ) : (
                  <Link href={`/errands/${errand.id}`} className="text-xs font-bold text-primary-700 underline">
                    Open
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {/* POST MODAL                                                     */}
      {/* ------------------------------------------------------------ */}
      <PostErrandModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onPosted={(id) => {
          setPostOpen(false);
          toast.success("Errand posted. A mover will claim it soon.");
          router.push(`/errands/${id}`);
        }}
      />
    </div>
  );
}

/**
 * PostErrandModal
 * WHAT: The form for posting a new errand.
 * WHY : Pickup, drop-off and fee are required - those three fields ARE the
 *       logistics contract between poster and mover.
 */
function PostErrandModal({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(ERRAND_CATEGORIES[0]);
  const [pickupPoint, setPickupPoint] = useState("");
  const [dropOffPoint, setDropOffPoint] = useState("");
  const [fee, setFee] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Naira input -> kobo for the API.
    const feeKobo = Math.round(Number(fee.replace(/[^\d.]/g, "")) * 100);
    if (!feeKobo) {
      setError("Enter the fee you are offering.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await sendApi<{ id: string }>("/api/errands", "POST", {
      title: title.trim(),
      description: description.trim(),
      // The API enum guarantees a non-food category.
      category,
      pickupPoint: pickupPoint.trim(),
      dropOffPoint: dropOffPoint.trim(),
      feeKobo,
      isNegotiable: negotiable,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Could not post the errand.");
      return;
    }
    onPosted(result.data.id);
  }

  return (
    <Modal open={open} onClose={onClose} title="Post an errand">
      <form onSubmit={submit} className="space-y-3">
        <Input label="What needs moving?" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Drop my transcript at the Faculty of Science office" required />
        <TextArea
          label="Details"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Who should the mover ask for? Any instructions for the handover?"
          required
        />
        <Select
          label="Task type (non-food only)"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          options={ERRAND_CATEGORIES.map((option) => ({ value: option, label: option }))}
        />
        <Input label="Pickup point" value={pickupPoint} onChange={(event) => setPickupPoint(event.target.value)} placeholder="Hostel B reception, Ekrejeta" required />
        <Input label="Drop-off point" value={dropOffPoint} onChange={(event) => setDropOffPoint(event.target.value)} placeholder="Faculty of Science front desk" required />
        <Input label="Task fee (₦)" value={fee} onChange={(event) => setFee(event.target.value)} inputMode="numeric" placeholder="1500" required />
        <Input label="Needed by (optional)" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} min={new Date().toISOString().slice(0, 16)} />
        <Checkbox checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} label="I am open to negotiating the fee" />

        <p className="rounded-xl bg-primary-50 p-3 text-[11px] leading-relaxed text-primary-900">
          When a mover claims the task you both see each other&apos;s contact details, so you can coordinate the handover
          on WhatsApp or a call. Settle the fee directly - confirm completion once the item reaches you.
        </p>

        {error ? <p className="rounded-xl bg-danger-light p-3 text-xs font-semibold text-danger-dark">{error}</p> : null}
        <Button type="submit" fullWidth loading={saving}>
          Post errand
        </Button>
      </form>
    </Modal>
  );
}
