/**
 * src/components/admin/FoodQueueClient.tsx
 * WHAT: The admin moderation queue for the food directory - approve
 *       suggested spots, remove bad ones, and manage sponsored slots.
 * WHY : Student suggestions keep the directory fresh, but nothing goes public
 *       until a real admin has checked the name, the WhatsApp number and the
 *       price estimate. Sponsorship is the directory's monetisation hook, so
 *       admins switch it here.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useFetch } from "@/hooks/useFetch";
import { sendApi } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { formatNaira } from "@/lib/money";
import { whatsappLink } from "@/lib/utils";
import { WhatsAppIcon, StarIcon } from "@/components/ui/Icons";

/** One vendor row as the admin API returns it. */
type AdminVendorView = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  priceMinKobo: number;
  priceMaxKobo: number;
  whatsAppNumber: string;
  websiteUrl: string | null;
  area: string;
  status: "SUGGESTED" | "ACTIVE" | "REMOVED";
  adminNote: string | null;
  isSponsored: boolean;
  suggestedBy: { fullName: string; phone: string } | null;
  institution: { shortName: string };
  reviewCount: number;
  createdAt: string;
};

/**
 * FoodQueueClient
 * WHAT: Pending/all toggle + one card per spot with the moderation actions.
 */
export function FoodQueueClient() {
  const toast = useToast();
  const [view, setView] = useState<"SUGGESTED" | "ALL">("SUGGESTED");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading } = useFetch<{ vendors: AdminVendorView[] }>(
    `/api/admin/food?status=${view}${refreshKey ? `&r=${refreshKey}` : ""}`
  );
  const vendors = data?.vendors ?? [];

  /** Sends one moderation decision. */
  async function decide(id: string, decision: "APPROVE" | "REMOVE" | "ACTIVATE" | "SPONSOR" | "UNSPONSOR", successMessage: string) {
    setBusyId(id);
    const result = await sendApi(`/api/admin/food`, "PATCH", { id, decision });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error ?? "That did not work.");
      return;
    }
    toast.success(successMessage);
    setRefreshKey((key) => key + 1);
  }

  return (
    <div>
      {/* Queue / all toggle. */}
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {([
          { value: "SUGGESTED", label: "Pending suggestions" },
          { value: "ALL", label: "All spots" },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setView(option.value)}
            className={`min-h-11 rounded-lg text-xs font-bold transition-colors ${
              view === option.value ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="px-1 py-8 text-center text-sm text-slate-500">Loading queue...</p>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<StarIcon size={32} />}
          title={view === "SUGGESTED" ? "No pending suggestions" : "No food spots yet"}
          message={view === "SUGGESTED" ? "Every suggested spot has been reviewed. Nice work." : "Students have not suggested any spots yet."}
        />
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor) => (
            <Card key={vendor.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{vendor.name}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {vendor.institution.shortName} &middot; {vendor.area} &middot; {formatDate(vendor.createdAt)}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {vendor.isSponsored ? <Badge tone="gold">Sponsored</Badge> : null}
                  <Badge tone={vendor.status === "ACTIVE" ? "success" : vendor.status === "SUGGESTED" ? "warn" : "slate"}>
                    {vendor.status.toLowerCase()}
                  </Badge>
                </span>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-600">{vendor.description}</p>

              <div className="mt-2 flex flex-wrap gap-1">
                {vendor.categories.map((chip) => (
                  <span key={chip} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {chip}
                  </span>
                ))}
              </div>

              <p className="mt-2 text-xs font-semibold text-slate-700">
                {formatNaira(vendor.priceMinKobo)} &ndash; {formatNaira(vendor.priceMaxKobo)} estimated
              </p>

              {/* Who suggested it - admins always see the real student. */}
              {vendor.suggestedBy ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  Suggested by <span className="font-semibold text-slate-700">{vendor.suggestedBy.fullName}</span> ({vendor.suggestedBy.phone})
                </p>
              ) : null}
              {vendor.reviewCount > 0 ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{vendor.reviewCount} student review{vendor.reviewCount === 1 ? "" : "s"}</p>
              ) : null}
              {vendor.websiteUrl ? (
                <a href={vendor.websiteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11px] font-bold text-primary-700 underline">
                  {vendor.websiteUrl}
                </a>
              ) : null}

              {/* Check the WhatsApp number actually opens - the directory's lifeline. */}
              <a
                href={whatsappLink(vendor.whatsAppNumber, "Hello! Checking your Mobile Campus directory listing.")}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-success-dark underline"
              >
                <WhatsAppIcon size={14} /> Test their WhatsApp ({vendor.whatsAppNumber})
              </a>

              {/* Moderation actions - only what makes sense for this state. */}
              <div className="mt-3 flex flex-wrap gap-2">
                {vendor.status === "SUGGESTED" ? (
                  <>
                    <Button size="sm" variant="primary" loading={busyId === vendor.id} onClick={() => decide(vendor.id, "APPROVE", `${vendor.name} is live on the directory.`)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" loading={busyId === vendor.id} onClick={() => decide(vendor.id, "REMOVE", "Suggestion removed.")}>
                      Reject
                    </Button>
                  </>
                ) : null}
                {vendor.status === "ACTIVE" ? (
                  <>
                    {vendor.isSponsored ? (
                      <Button size="sm" variant="ghost" loading={busyId === vendor.id} onClick={() => decide(vendor.id, "UNSPONSOR", "Sponsored slot removed.")}>
                        Remove sponsorship
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" loading={busyId === vendor.id} onClick={() => decide(vendor.id, "SPONSOR", "Sponsored for 30 days.")}>
                        Grant sponsored slot
                      </Button>
                    )}
                    <Button size="sm" variant="danger" loading={busyId === vendor.id} onClick={() => decide(vendor.id, "REMOVE", "Spot removed from the directory.")}>
                      Take down
                    </Button>
                  </>
                ) : null}
                {vendor.status === "REMOVED" ? (
                  <Button size="sm" loading={busyId === vendor.id} onClick={() => decide(vendor.id, "ACTIVATE", "Spot is back on the directory.")}>
                    Restore
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
