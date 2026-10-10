/**
 * src/components/ui/Skeleton.tsx
 * WHAT: Grey placeholder blocks that shimmer while real data loads.
 * WHY : A blank screen makes users think the app has frozen - especially on a
 *       slow 3G connection. A skeleton shows the shape of what is coming and
 *       stops the layout from jumping when the data arrives.
 */
import { cn } from "@/lib/utils";

/**
 * Skeleton
 * WHAT: One shimmering block.
 * WHY : Compose several of these to sketch any card shape.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("mc-skeleton", className)} aria-hidden="true" />;
}

/**
 * LodgeCardSkeleton
 * WHAT: The skeleton shape of a lodge card (image on top, three text rows).
 * WHY : Matches the real card's height exactly, so nothing shifts when the
 *       listing loads.
 */
export function LodgeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

/**
 * ListSkeleton
 * WHAT: A vertical stack of card skeletons.
 * WHY : Every list page (housing, market, gigs, notifications) uses this while
 *       fetching.
 */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100">
          <div className="flex gap-3">
            <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * PageSkeleton
 * WHAT: A whole-page loading state with a title bar and a list.
 * WHY : Used by Suspense boundaries so a route transition never shows a white
 *       flash.
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-64" />
      <ListSkeleton rows={5} className="mt-6" />
    </div>
  );
}
