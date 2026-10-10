/**
 * src/components/housing/HousingBrowser.tsx
 * WHAT: The interactive housing search screen - filter chips, the filter sheet,
 *       the results list, skeletons while loading and a "load more" button.
 * WHY : It is a client component because filtering, sorting and paging all
 *       happen without a full page reload. The first page of results is passed in
 *       from the server so nothing is blank on arrival.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { LodgeCardSkeleton } from "@/components/ui/Skeleton";
import { FilterIcon, SearchIcon, HomeIcon } from "@/components/ui/Icons";
import { LodgeCard, type LodgeCardData } from "./LodgeCard";
import { LodgeFilters, emptyLodgeFilters, type LodgeFilterValues } from "./LodgeFilters";
import { StaggerList } from "@/components/motion/StaggerList";
import { useInstitutionAreas } from "@/hooks/useInstitutionAreas";
import { parseNairaInput } from "@/lib/money";
import { useToast } from "@/components/ui/Toast";

/** One page of results as returned by /api/housing. */
type HousingResponse = {
  lodges: LodgeCardData[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * buildQuery
 * WHAT: Turns the filter state into a URL query string.
 * WHY : Keeping the filters in the URL means a filtered search can be shared
 *       with a friend over WhatsApp and will open with the same results.
 */
function buildQuery(filters: LodgeFilterValues, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.area) params.set("area", filters.area);
  if (filters.minRent) params.set("minRentKobo", String(parseNairaInput(filters.minRent)));
  if (filters.maxRent) params.set("maxRentKobo", String(parseNairaInput(filters.maxRent)));
  if (filters.roomType) params.set("roomType", filters.roomType);
  if (filters.water) params.set("water", filters.water);
  if (filters.meter) params.set("meter", filters.meter);
  if (filters.maxDistance) params.set("maxDistanceMeters", filters.maxDistance);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (!filters.verifiedOnly) params.set("verifiedOnly", "false");
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

type HousingBrowserProps = {
  /** First page of results, rendered by the server. */
  initial: HousingResponse;
  /** Filters parsed from the URL on the server. */
  initialFilters: LodgeFilterValues;
};

/**
 * HousingBrowser
 * WHAT: The whole search experience.
 * WHY : One component owns the filter state, the fetch and the list, so they can
 *       never get out of sync.
 */
export function HousingBrowser({ initial, initialFilters }: HousingBrowserProps) {
  const toast = useToast();

  // MULTI-CAMPUS: area chips come from the viewer's institution.
  const areas = useInstitutionAreas();

  const [filters, setFilters] = useState<LodgeFilterValues>(initialFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lodges, setLodges] = useState<LodgeCardData[]>(initial.lodges);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  // True while we are appending a second page rather than replacing the list.
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState(initialFilters.q);

  /** How many active filters there are, for the badge on the filter button. */
  const activeFilterCount = useMemo(() => {
    return [filters.area, filters.minRent, filters.maxRent, filters.roomType, filters.water, filters.meter, filters.maxDistance].filter(
      Boolean
    ).length;
  }, [filters]);

  /**
   * load
   * WHAT: Fetches a page of results for the current filters.
   * WHY : Used both when the filters change (page 1) and for "load more".
   */
  const load = useCallback(async (nextFilters: LodgeFilterValues, nextPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const response = await fetch(`/api/housing?${buildQuery(nextFilters, nextPage)}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: HousingResponse; error?: string };

      if (!response.ok || !payload.data) {
        toast.error(payload.error ?? "Could not load lodges.");
        return;
      }

      setTotal(payload.data.total);
      setPage(payload.data.page);
      setLodges((current) => (append ? [...current, ...payload.data!.lodges] : payload.data!.lodges));
    } catch {
      toast.error("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Re-fetch whenever the filters change (but not on the very first render,
   *  because the server already gave us page 1). */
  const isFirstRender = useMemo(() => ({ current: true }), []);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void load(filters, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  /** Applies the filter sheet values and closes it. */
  function applyFilters(values: LodgeFilterValues) {
    setFilters(values);
    setSheetOpen(false);
  }

  /** Submits the search box. */
  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setFilters((current) => ({ ...current, q: searchText }));
  }

  const hasMore = lodges.length < total;

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* SEARCH + FILTER BAR                                               */}
      {/* ---------------------------------------------------------------- */}
      <form onSubmit={submitSearch} className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search Ekrejeta, self contain..."
            aria-label="Search lodges"
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setSheetOpen(true)}
          className="px-3.5"
          aria-label="Open filters"
        >
          <FilterIcon size={18} />
          {activeFilterCount > 0 ? (
            <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </form>

      {/* Quick area chips - the fastest filter there is. */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <button
          type="button"
          onClick={() => setFilters((current) => ({ ...current, area: "" }))}
          className={`mc-chip shrink-0 ${filters.area === "" ? "border-primary-600 bg-primary-600 text-white" : ""}`}
        >
          All areas
        </button>
        {areas.map((area) => (
          <button
            key={area}
            type="button"
            onClick={() => setFilters((current) => ({ ...current, area }))}
            className={`mc-chip shrink-0 ${filters.area === area ? "border-primary-600 bg-primary-600 text-white" : ""}`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="mb-3 px-1 text-xs text-slate-500">
        {loading ? "Searching..." : `${total} lodge${total === 1 ? "" : "s"} found`}
      </p>

      {/* ---------------------------------------------------------------- */}
      {/* RESULTS                                                           */}
      {/* ---------------------------------------------------------------- */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <LodgeCardSkeleton key={index} />
          ))}
        </div>
      ) : lodges.length === 0 ? (
        <EmptyState
          icon={<HomeIcon size={32} />}
          title="No lodges match those filters"
          message="Try widening your price range, choosing a different area, or turning off 'Verified lodges only'."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setFilters(emptyLodgeFilters);
                setSearchText("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <StaggerList gap={12} inView>
          {lodges.map((lodge) => (
            <LodgeCard key={lodge.id} lodge={lodge} />
          ))}
        </StaggerList>
      )}

      {/* Load more - cheaper than infinite scroll on a slow connection because
          the student decides when to spend the data. */}
      {hasMore && !loading ? (
        <Button variant="secondary" fullWidth loading={loadingMore} onClick={() => void load(filters, page + 1, true)} className="mt-4">
          Load {Math.min(12, total - lodges.length)} more
        </Button>
      ) : null}

      {/* A shortcut for landlords. */}
      <p className="mt-6 text-center text-xs text-slate-500">
        Have a lodge to rent out?{" "}
        <Link href="/housing/new" className="font-bold text-primary-700">
          List it here
        </Link>
      </p>

      {/* The filter sheet */}
      <LodgeFilters open={sheetOpen} onClose={() => setSheetOpen(false)} values={filters} onApply={applyFilters} resultCount={total} />
    </div>
  );
}
