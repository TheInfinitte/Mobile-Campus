/**
 * src/components/layout/BottomNav.tsx
 * WHAT: The fixed bottom navigation bar shown on phones.
 * WHY : On a phone the bottom of the screen is where the thumb naturally rests.
 *       Five tabs, each at least 44px, is the standard mobile pattern.
 *
 * ROLE-AWARE:
 *   - Students/guests: Housing, Market, Gigs, Campus (hub), Profile.
 *   - Landlords: a property-only bar (Housing, Listings, Payments, Profile) -
 *     they never see student social features.
 *
 * DESIGN DETAILS:
 *   - The active tab is indigo with a small gold underline.
 *   - The bar sits above the phone's home indicator (safe-area padding).
 *   - A notification dot appears on Profile when there are unread alerts.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BagIcon, CapIcon, HomeIcon, ShieldIcon, TaskIcon, UserIcon } from "@/components/ui/Icons";
import type { UserRole } from "@prisma/client";

/** Student tabs: "Campus" opens the hub with Roommates, Community, Projects... */
const STUDENT_TABS = [
  { href: "/housing", label: "Housing", Icon: HomeIcon },
  { href: "/market", label: "Market", Icon: BagIcon },
  { href: "/gigs", label: "Gigs", Icon: TaskIcon },
  { href: "/campus", label: "Campus", Icon: CapIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
] as const;

/** Landlord tabs: property business only. */
const LANDLORD_TABS = [
  { href: "/housing", label: "Housing", Icon: HomeIcon },
  { href: "/landlord", label: "Listings", Icon: ShieldIcon },
  { href: "/escrow", label: "Payments", Icon: TaskIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
] as const;

/**
 * BottomNav
 * WHAT: Renders the role's tabs and highlights the active one.
 * WHY : Uses usePathname so the highlight follows the browser's back/forward
 *       buttons, not just clicks.
 */
export function BottomNav({ unreadCount = 0, role }: { unreadCount?: number; role?: UserRole }) {
  const pathname = usePathname();
  const tabs = role === "LANDLORD" ? LANDLORD_TABS : STUDENT_TABS;

  return (
    <nav
      // Hide on tablets and up - those screens get the desktop side/top nav.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
      // safe-area padding keeps the icons above the iPhone home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch">
        {tabs.map(({ href, label, Icon }) => {
          // A tab is active when the URL starts with its href.
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[72px] flex-col items-center justify-center gap-1 px-1 transition-colors",
                  active ? "text-primary-700" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {/* The moving indicator. `layoutId` makes Framer Motion slide
                    one shared element between tabs instead of fading two. */}
                {active ? (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-gold-500"
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  />
                ) : null}

                <span className="relative">
                  <Icon size={22} />
                  {/* Unread badge on the Profile tab. */}
                  {href === "/profile" && unreadCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>

                <span className={cn("text-[10px] font-semibold leading-none", active && "font-bold")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
