/**
 * src/components/layout/MobileHeader.tsx
 * WHAT: The compact header shown at the top of every page on phones: brand on
 *       the left, notification bell on the right.
 * WHY : Phones have no room for a full nav bar, but the user still needs to know
 *       where they are and reach their notifications in one tap.
 */
import Link from "next/link";
import { BellIcon } from "@/components/ui/Icons";

/**
 * MobileHeader
 * WHAT: A sticky 56px header for small screens.
 * WHY : It disappears on md+ where DesktopNav takes over.
 */
export function MobileHeader({ unreadCount = 0, campusLabel }: { unreadCount?: number; campusLabel?: string }) {
  // MULTI-CAMPUS: the brand line shows the viewer's own institution.
  // The server component (Shell) resolves it and passes it down - a client
  // component must never call next/headers-based helpers itself.

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Brand - taps back to the home page. */}
        <Link href="/" className="flex items-center gap-2" aria-label="Mobile Campus home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-xs font-black text-white">
            MC
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-slate-900">Mobile Campus</span>
            <span className="block text-[10px] font-medium text-slate-500">{campusLabel ?? "Nigeria"}</span>
          </span>
        </Link>

        {/* Notifications */}
        <Link
          href="/notifications"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors active:bg-slate-100"
        >
          <BellIcon size={20} />
          {unreadCount > 0 ? (
            <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
