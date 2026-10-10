/**
 * src/components/layout/Shell.tsx
 * WHAT: The app frame that wraps every page. It decides which navigation to show
 *       (phone bottom bar, tablet top bar, desktop sidebar), applies the correct
 *       content padding, and publishes the signed-in user to client components.
 * WHY : One component owns all of the chrome, so no page ever forgets the bottom
 *       padding (the classic "last card hidden behind the nav" bug) and no page
 *       has to fetch the current user itself.
 */
"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BottomNav } from "./BottomNav";
import { DesktopNav } from "./DesktopNav";
import { MobileHeader } from "./MobileHeader";
import type { User, UserRole } from "@prisma/client";

/** The safe subset of the user object that is sent to the browser. */
export type SessionUser = {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isVerified: boolean;
  verificationStatus: "UNVERIFIED" | "PROVISIONAL" | "VERIFIED" | "REJECTED";
  avatarUrl: string | null;
  level: string | null;
  department: string | null;
};

/** Context value: who is signed in, and how many notifications are unread. */
type SessionContextValue = { user: SessionUser | null; unreadCount: number };

const SessionContext = createContext<SessionContextValue>({ user: null, unreadCount: 0 });

/**
 * useSession
 * WHAT: Reads the current session inside a client component.
 * WHY : `const { user } = useSession()` costs nothing, unlike calling an API on
 *       every page just to find out who is logged in.
 */
export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

/** Routes that get no navigation at all (sign-in, sign-up, the offline page). */
const BARE_ROUTES = ["/auth", "/offline"];

/**
 * Routes with their OWN complete frame.
 * WHY : /admin renders its own sidebar (AdminSidebar) and its own mobile
 *       header (AdminMobileNav). Wrapping it in this Shell too would stack a
 *       second top bar and a second sidebar on top of those - the exact
 *       "same links twice" problem. Admin pages never call useSession(), so
 *       skipping the Shell frame costs them nothing.
 */
const SELF_FRAMED_ROUTES = ["/admin"];

type ShellProps = {
  children: React.ReactNode;
  /** The signed-in user as read on the server. Null when signed out. */
  user: User | null;
  unreadCount: number;
  // Shown under the brand in the phone header; resolved by the server layout.
  campusLabel?: string;
};

/**
 * Shell
 * WHAT: Renders the navigation and the content area, and provides the session.
 * WHY : It is the single place that knows how the app is framed at every screen
 *       size.
 */
export function Shell({ children, user, unreadCount, campusLabel }: ShellProps) {
  const pathname = usePathname();

  // Auth and offline pages get a bare frame with no navigation.
  const isBare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  // /admin brings its own sidebar and mobile header; adding this Shell's
  // navigation on top would show the same links twice.
  const isSelfFramed = SELF_FRAMED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Only safe fields cross from the server to the browser - never the password
  // hash and never an encrypted identifier.
  const sessionUser: SessionUser | null = user
    ? {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        avatarUrl: user.avatarUrl,
        level: user.level,
        department: user.department,
      }
    : null;

  return (
    <SessionContext.Provider value={{ user: sessionUser, unreadCount }}>
      {isBare ? (
        <main className="min-h-screen bg-slate-50">{children}</main>
      ) : isSelfFramed ? (
        // No wrapper chrome at all: the route renders its own sidebar, header
        // and padding. A plain div keeps the HTML valid - the nested route
        // supplies the single <main> landmark for the page.
        <div className="min-h-screen bg-slate-50">{children}</div>
      ) : (
        <div className="min-h-screen bg-slate-50">
          {/* Phone header - hidden from md upwards. */}
          <MobileHeader unreadCount={unreadCount} campusLabel={campusLabel} />

          {/* Tablet and desktop navigation - hidden below md. */}
          <DesktopNav user={user} unreadCount={unreadCount} />

          {/* Content area.
              FLUID, LEFT-ALIGNED: this used to be `mx-auto` with a narrow
              max-w-3xl, which pinned everything to the middle of the screen
              and left large monitors half empty. It is now w-full up to
              max-w-7xl, so content starts at the left edge and scales up
              with the viewport.
              - From lg we offset by the 240px sidebar (matches the lg:block
                breakpoint in DesktopNav) instead of pushing content sideways
                with a centred container.
              - pb-safe adds the bottom-nav height plus the iOS safe area, so
                the last card is never hidden behind the navigation. */}
          <main
            className={cn(
              "w-full max-w-7xl px-4 pb-safe pt-5 sm:px-6",
              "md:pt-8",
              "lg:pl-[calc(15rem+1.5rem)] lg:pr-6"
            )}
          >
            {children}
          </main>

          {/* Phone bottom navigation - hidden from md upwards. */}
          <BottomNav unreadCount={unreadCount} role={user?.role} />
        </div>
      )}
    </SessionContext.Provider>
  );
}
