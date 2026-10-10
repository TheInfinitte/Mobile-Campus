/**
 * src/lib/admin-nav.ts
 * WHAT: The single list of admin sections - path, label, hint and icon - used
 *       by both the desktop sidebar and the mobile admin menu.
 * WHY : Before this file existed, every admin page repeated its own guard and
 *       the dashboard listed sections by hand, so adding a section meant
 *       editing several files and it was easy to leave one inconsistent.
 *
 * `staffOnly` and `superAdminOnly` drive two things at once: what appears in
 * the sidebar, and what the layout's server-side guard allows. That way a
 * section can never show a link that the guard would then bounce.
 */
import type { UserRole } from "@prisma/client";
// The icons are imported here so the map below can reference the real
// components. This module is only imported by CLIENT components and the server
// layout - never by middleware - so pulling in JSX is safe.
import {
  AlertIcon,
  BagIcon,
  BoltIcon,
  CapIcon,
  ChartIcon,
  EyeIcon,
  HomeIcon,
  InfoIcon,
  PeopleIcon,
  SettingsIcon,
  ShieldIcon,
  TaskIcon,
} from "@/components/ui/Icons";

/**
 * ADMIN_ICONS
 * WHAT: The small set of icons the admin nav is allowed to draw.
 * WHY : Declaring the names here keeps admin-nav.ts free of component imports
 *       (so it stays Edge-safe and serialisable), while still giving the
 *       client components a typed way to look the real component up.
 */
export const ADMIN_ICONS = {
  AlertIcon,
  BagIcon,
  BoltIcon,
  CapIcon,
  ChartIcon,
  EyeIcon,
  HomeIcon,
  InfoIcon,
  PeopleIcon,
  SettingsIcon,
  ShieldIcon,
  TaskIcon,
} as const;

/** The allowed icon names, derived from the map so the two cannot drift. */
export type AdminIconName = keyof typeof ADMIN_ICONS;

/** One row in the admin sidebar. */
export interface AdminSection {
  href: string;
  label: string;
  /** One short line explaining what the section is for. */
  hint: string;
  /**
   * Which icon to draw, as a name rather than the component itself.
   * WHY : The section list crosses from the server layout into client
   *       components as props. React cannot serialise a function, so passing
   *       the component here crashes with "Functions cannot be passed directly
   *       to Client Components". A string survives that boundary, and the
   *       client components resolve it with ADMIN_ICONS below.
   */
  icon: AdminIconName;
  /** Group heading this row sits under in the sidebar. */
  group: "Overview" | "Trust & safety" | "Operations";
  /**
   * SUPER_ADMIN-only sections stay completely hidden from ordinary admins.
   * Hiding (rather than greying out) avoids tempting staff to click something
   * they will always be refused.
   */
  superAdminOnly?: boolean;
  /**
   * When set, the page supplies a live count (e.g. 12 pending verifications)
   * and the sidebar shows it as a badge. The key matches AdminCounts below.
   */
  countKey?: keyof AdminCounts;
}

/** Live badge numbers, fetched once by the admin layout. */
export interface AdminCounts {
  verifications: number;
  disputes: number;
  reports: number;
  moderation: number;
}

/**
 * ADMIN_SECTIONS
 * WHAT: Every admin page, in the order it should appear.
 * WHY : The sidebar, the dashboard quick links and the layout guard all read
 *       this one array, so they can never disagree about what exists.
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    href: "/admin",
    label: "Dashboard",
    hint: "Platform health and today's numbers",
    icon: "ChartIcon",
    group: "Overview",
  },

  // --- Trust & safety: the queues that protect students ---
  {
    href: "/admin/verifications",
    label: "Verification queue",
    hint: "Approve or reject student IDs and JAMB proofs",
    icon: "ShieldIcon",
    group: "Trust & safety",
    countKey: "verifications",
  },
  {
    href: "/admin/disputes",
    label: "Escrow disputes",
    hint: "Review contested payments, refund or release",
    icon: "AlertIcon",
    group: "Trust & safety",
    countKey: "disputes",
  },
  {
    href: "/admin/reports",
    label: "Scam reports",
    hint: "Reports students filed against people or posts",
    icon: "InfoIcon",
    group: "Trust & safety",
    countKey: "reports",
  },
  {
    href: "/admin/moderation",
    label: "Content moderation",
    hint: "Market items, gigs and rooms: flag, hide, restore, delete",
    icon: "EyeIcon",
    group: "Trust & safety",
    countKey: "moderation",
  },
  {
    href: "/admin/users",
    label: "User management",
    hint: "Search accounts, suspend, lift bans, change roles",
    icon: "PeopleIcon",
    group: "Trust & safety",
    superAdminOnly: true,
  },

  // --- Operations: everything else staff run day to day ---
  {
    href: "/admin/listings",
    label: "All listings",
    hint: "Search, verify or take down any room",
    icon: "HomeIcon",
    group: "Operations",
  },
  {
    href: "/admin/food",
    label: "Food directory",
    hint: "Approve suggested food spots, manage sponsored slots",
    icon: "BagIcon",
    group: "Operations",
  },
  {
    href: "/admin/emergency",
    label: "Urgent 2k board",
    hint: "Goodwill requests, commitment trail and pause reviews",
    icon: "BoltIcon",
    group: "Operations",
  },
  {
    href: "/admin/study",
    label: "Study vault",
    hint: "Approve uploaded notes and past questions",
    icon: "CapIcon",
    group: "Operations",
  },
  {
    href: "/admin/community",
    label: "Community board",
    hint: "Moderate gist posts and study projects",
    icon: "TaskIcon",
    group: "Operations",
  },
  {
    href: "/admin/fees",
    label: "Fee configuration",
    hint: "The single source of truth for what we charge",
    icon: "SettingsIcon",
    group: "Operations",
  },
];

/**
 * sectionsForRole
 * WHAT: Filters the section list down to what this admin tier may see.
 * WHY : One helper keeps the sidebar and the mobile menu in step, and makes
 *       the SUPER_ADMIN-only rule impossible to forget in a new page.
 */
export function sectionsForRole(role: UserRole): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => !s.superAdminOnly || role === "SUPER_ADMIN");
}

/**
 * groupsForRole
 * WHAT: The visible sections grouped under their headings, in order.
 * WHY : The sidebar renders headings, so it needs the data pre-grouped.
 *       Doing it here means the component stays presentational.
 */
export function groupsForRole(role: UserRole): { group: AdminSection["group"]; sections: AdminSection[] }[] {
  const visible = sectionsForRole(role);
  const order: AdminSection["group"][] = ["Overview", "Trust & safety", "Operations"];
  return order
    .map((group) => ({ group, sections: visible.filter((s) => s.group === group) }))
    .filter((entry) => entry.sections.length > 0);
}
