/**
 * src/components/ui/Icons.tsx
 * WHAT: Every icon used in the app, as small inline SVG React components.
 * WHY : Three good reasons on a mobile-first Nigerian product:
 *       1. Zero extra downloads - no icon font or sprite sheet to fetch.
 *       2. Icons inherit `currentColor`, so they match the text colour around
 *          them automatically.
 *       3. Tree-shaking: unused icons are removed from the production bundle.
 *
 * All icons are 24x24 with a 2px stroke (the "line icon" look).
 */
import type { SVGProps } from "react";

/** Shared props so every icon behaves the same. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Base
 * WHAT: The common <svg> wrapper.
 * WHY : One place sets the size, stroke width, accessibility attributes and
 *       the "decorative by default" rule (aria-hidden). Pass a `title` to make
 *       an icon meaningful to screen readers.
 */
function Base({ size = 24, children, title, ...rest }: IconProps & { children: React.ReactNode; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // If there is no title the icon is decoration; hide it from screen readers.
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* -------------------------------------------------------------------------
   NAVIGATION ICONS (the five bottom-nav tabs plus admin)
   ------------------------------------------------------------------------- */

/** Housing: a simple house. */
export const HomeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Base>
);

/** Market: a shopping bag. */
export const BagIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 8h14l-1 12H6L5 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Base>
);

/** Gigs: a clipboard with a task tick. */
export const TaskIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 4h6v3H9z" />
    <path d="M15 5.5h2.5A1.5 1.5 0 0 1 19 7v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V7a1.5 1.5 0 0 1 1.5-1.5H9" />
    <path d="m9 14 2 2 4-4" />
  </Base>
);

/** Budget AI: a sparkle / magic wand. */
export const SparkleIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
    <path d="M18 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
  </Base>
);

/** Profile: a person. */
export const UserIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Base>
);

/** Admin: a shield. */
export const ShieldIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3Z" />
  </Base>
);

/* -------------------------------------------------------------------------
   FEATURE ICONS
   ------------------------------------------------------------------------- */

/** Verified badge: shield with a tick. */
export const VerifiedIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Base>
);

/** Water drop (borehole status). */
export const DropIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3s5.5 6 5.5 9.5A5.5 5.5 0 0 1 12 18a5.5 5.5 0 0 1-5.5-5.5C6.5 9 12 3 12 3Z" />
  </Base>
);

/** Electricity bolt (meter type). */
export const BoltIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M13 3 6 13h5l-1 8 7-10h-5l1-8Z" />
  </Base>
);

/** Distance: a map pin. */
export const PinIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 21s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  </Base>
);

/** Money / Naira note. */
export const MoneyIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M7 12h.01M17 12h.01" />
  </Base>
);

/** Escrow: a padlock. */
export const LockIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Base>
);

/** Chat bubble. */
export const ChatIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 5h16v11H9l-5 4V5Z" />
  </Base>
);

/** WhatsApp: the phone-in-bubble mark (simplified). */
export const WhatsAppIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20l1.3-3.8A7.6 7.6 0 1 1 8 18.8L4 20Z" />
    <path d="M9.3 9c.3-.7.6-.7 1-.7h.5c.2 0 .5 0 .7.5l.8 1.8c.1.3 0 .5-.1.7l-.4.5c-.1.2-.2.4 0 .7a5.6 5.6 0 0 0 2.5 2.1c.3.1.5 0 .7-.1l.5-.6c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.6 0 .8-.6 1.6-1.4 1.8-.6.2-1.4.2-3.2-.5a8.7 8.7 0 0 1-4.4-4.4C8.4 10.6 8.5 9.8 9.3 9Z" />
  </Base>
);

/** Phone. */
export const PhoneIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 3h3l1.5 4-2 1.5a10 10 0 0 0 5 5L15 11.5 19 13v3a2 2 0 0 1-2.2 2A14 14 0 0 1 4 5.2 2 2 0 0 1 6 3Z" />
  </Base>
);

/** Search magnifier. */
export const SearchIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

/** Filter sliders. */
export const FilterIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h10M4 17h6" />
    <circle cx="18" cy="12" r="2" />
    <circle cx="13" cy="17" r="2" />
  </Base>
);

/** Star (ratings). */
export const StarIcon = (props: IconProps & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <Base {...rest} fill={filled ? "currentColor" : "none"}>
      <path d="m12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 4Z" />
    </Base>
  );
};

/** Heart (shortlist). */
export const HeartIcon = (props: IconProps & { filled?: boolean }) => {
  const { filled, ...rest } = props;
  return (
    <Base {...rest} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
    </Base>
  );
};

/** Bell (notifications). */
export const BellIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Base>
);

/** Check. */
export const CheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m5 13 4 4L19 7" />
  </Base>
);

/** Close / X. */
export const CloseIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

/** Warning triangle (reports, disputes). */
export const AlertIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 4 2.8 20h18.4L12 4Z" />
    <path d="M12 10v4M12 17h.01" />
  </Base>
);

/** Info circle. */
export const InfoIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Base>
);

/** Arrow left (back buttons). */
export const ArrowLeftIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);

/** Arrow right (next step). */
export const ArrowRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

/** Camera (photo upload). */
export const CameraIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
    <circle cx="12" cy="13" r="3.2" />
  </Base>
);

/** Bed (room type). */
export const BedIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 18v-7h16v7" />
    <path d="M4 14h16M4 18v2M20 18v2" />
    <path d="M7 11V8h6v3" />
  </Base>
);

/** People (roommates). */
export const PeopleIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19a6 6 0 0 1 12 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8M17 13.5a6 6 0 0 1 4 5.5" />
  </Base>
);

/** Chart (admin revenue). */
export const ChartIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Base>
);

/** Settings sliders (fee config). */
export const SettingsIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
  </Base>
);

/** Logout. */
export const LogoutIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Base>
);

/** Send (chat / messages). */
export const SendIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 12 20 4l-6 16-3-6-7-2Z" />
  </Base>
);

/** Clock (viewing times). */
export const ClockIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);

/** Image placeholder. */
export const ImageIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17 5-5 4 4 3-2 4 3" />
  </Base>
);

/** Refresh (resend OTP, retry). */
export const RefreshIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 4v5h-5" />
  </Base>
);

/** Chevron down. */
export const ChevronDownIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

/** Chevron right. */
export const ChevronRightIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m9 6 6 6-6 6" />
  </Base>
);

/** Plus (add new listing, add photo). */
export const PlusIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

/** Menu (desktop/mobile header). */
export const MenuIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

/** Graduation cap (DELSU branding, fresher badge). */
export const CapIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m12 4 10 5-10 5L2 9l10-5Z" />
    <path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />
  </Base>
);

/** Trash (admin remove). */
export const TrashIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
  </Base>
);

/** Copy (copying a bank account number without mistyping it). */
export const CopyIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 012-2h8" />
  </Base>
);

/** Eye (admin viewing documents). */
export const EyeIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Base>
);
