/**
 * src/components/admin/ListingsClient.tsx
 * WHAT: The searchable listing table with per-row status controls.
 * WHY : Text search plus a status filter gets an admin to one specific room fast,
 *       which is the whole job of this screen.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StaggerList } from "@/components/motion/StaggerList";
import { SmartImage } from "@/components/ui/SmartImage";
import { SearchIcon, HomeIcon } from "@/components/ui/Icons";
import { sendApi } from "@/lib/api-client";
import { useFetch } from "@/hooks/useFetch";
import { useToast } from "@/components/ui/Toast";
import { formatNaira } from "@/lib/money";
import { timeAgo, cn } from "@/lib/utils";

/** One listing row as the API returns it. */
type ListingRow = {
  id: string;
  title: string;
  area: string;
  monthlyRentKobo: number;
  isVerified: boolean;
  status: string;
  availableRooms: number;
  ratingAverage: number;
  reviewCount: number;
  viewingCount: number;
  coverImage: string | null;
  createdAt: string;
  landlord: { id: string; fullName: string; phone: string; isVerified: boolean };
};

const TABS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "REMOVED", label: "Removed" },
];

/**
 * ListingsClient
 * WHAT: Filters and renders every listing.
 * WHY : Filtering happens in the browser (the API already caps at 100 rows) so
 *       typing in the search box costs no network request.
 */
export function ListingsClient({ counts }: { counts: Record<string, number> }) {
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading } = useFetch<{ lodges: ListingRow[] }>(`/api/admin/listings?status=${status || ""}&_=${reloadKey}`);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // Wrap the fallback in useMemo so the array identity is stable between
  // renders - otherwise `filtered` below would recompute on every keystroke of
  // an unrelated re-render.
  const all = useMemo(() => data?.lodges ?? [], [data]);

  // Case-insensitive match across title, area and landlord name.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((lodge) =>
      `${lodge.title} ${lodge.area} ${lodge.landlord.fullName}`.toLowerCase().includes(needle)
    );
  }, [all, query]);

  /** Changes one listing's status. */
  async function changeStatus(lodge: ListingRow, next: string) {
    const result = await sendApi<{ id: string; status: string }>("/api/admin/listings", "PATCH", { id: lodge.id, status: next });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${lodge.title} is now ${next.toLowerCase().replace("_", " ")}.`);
    refresh();
  }

  return (
    <div>
      {/* ------------------------------------------------------------ */}
      {/* SEARCH AND TABS                                                */}
      {/* ------------------------------------------------------------ */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
        <SearchIcon size={18} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, area or landlord"
          aria-label="Search listings"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

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
            {tab.value && counts[tab.value] ? <span className="ml-1 font-bold">({counts[tab.value]})</span> : null}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------ */}
      {/* THE LIST                                                       */}
      {/* ------------------------------------------------------------ */}
      {loading && all.length === 0 ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<HomeIcon size={32} />} title="No listings match" message="Try a different search, or switch to the All tab." />
      ) : (
        <StaggerList gap={10} inView>
          {filtered.map((lodge) => (
            <Card key={lodge.id} padded={false} className="overflow-hidden">
              <div className="flex gap-3 p-3">
                <SmartImage src={lodge.coverImage} alt={lodge.title} width={200} rounded="lg" wrapperClassName="h-20 w-20 shrink-0" />

                <div className="min-w-0 flex-1">
                  <Link href={`/housing/${lodge.id}`} className="block truncate text-sm font-bold text-slate-900 underline decoration-slate-200 underline-offset-2">
                    {lodge.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {lodge.area} · {formatNaira(lodge.monthlyRentKobo)}/month
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {lodge.landlord.isVerified ? <VerifiedBadge /> : <Badge tone="slate">Landlord unverified</Badge>}
                    <Badge tone={lodge.status === "ACTIVE" ? "success" : lodge.status === "REMOVED" ? "danger" : "gold"}>
                      {lodge.status.toLowerCase().replace("_", " ")}
                    </Badge>
                  </div>

                  <p className="mt-1.5 text-[10px] text-slate-400">
                    {lodge.landlord.fullName} · {lodge.viewingCount} viewings · {lodge.reviewCount} reviews · listed {timeAgo(lodge.createdAt)}
                  </p>
                </div>
              </div>

              {/* One-tap status changes - the reason this screen exists. */}
              <div className="flex gap-2 border-t border-slate-100 px-3 py-2">
                {lodge.status !== "ACTIVE" ? (
                  <button type="button" onClick={() => changeStatus(lodge, "ACTIVE")} className="mc-btn-secondary flex-1 py-2 text-[11px]">
                    Make active
                  </button>
                ) : null}
                {lodge.status !== "INACTIVE" ? (
                  <button type="button" onClick={() => changeStatus(lodge, "INACTIVE")} className="mc-btn-secondary flex-1 py-2 text-[11px]">
                    Hide it
                  </button>
                ) : null}
                {lodge.status !== "REMOVED" ? (
                  <button type="button" onClick={() => changeStatus(lodge, "REMOVED")} className="mc-btn-secondary flex-1 border-danger/30 py-2 text-[11px] text-danger-dark">
                    Take down
                  </button>
                ) : null}
              </div>
            </Card>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
