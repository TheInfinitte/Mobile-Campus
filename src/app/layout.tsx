/**
 * src/app/layout.tsx
 * WHAT: The root layout - the HTML shell every page is rendered inside.
 * WHY : This is where we set the page metadata (title, description, PWA theme
 *       colour and manifest), read the session cookie ONCE for the whole app,
 *       and wrap everything in the client-side providers and navigation shell.
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Shell } from "@/components/layout/Shell";
import { getSessionUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import { getViewerInstitution } from "@/lib/institution";
import { env } from "@/lib/env";

/** Browser tab and search-engine metadata. */
export const metadata: Metadata = {
  title: {
    default: "Mobile Campus | DELSU, Abraka",
    // Every route automatically gets "... | Mobile Campus" appended.
    template: "%s | Mobile Campus",
  },
  description:
    "Verified off-campus housing, a student marketplace, micro-gigs with escrow protection and an AI budget assistant for Delta State University, Abraka students.",
  applicationName: env.app.name,
  keywords: ["DELSU", "Abraka", "student housing", "off campus", "roommate", "escrow", "Nigeria"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mobile Campus",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

/** Theme colour used by the browser chrome and the PWA install prompt. */
export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // "cover" is required for the safe-area insets on notched phones.
  viewportFit: "cover",
};

/**
 * RootLayout
 * WHAT: Wraps every page in <html>/<body>, the client providers and the shell.
 * WHY : Reading the session here means no individual page has to do it, and the
 *       navigation always knows who is signed in.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // One database read for the user, one for their unread notification count.
  const user = await getSessionUser();
  const unread = user ? await unreadCount(user.id) : 0;
  // MULTI-CAMPUS: resolve the viewer's school once, at the very top of the
  // tree, and pass the label down - client components cannot read cookies.
  const institution = await getViewerInstitution();
  const campusLabel = `${institution.shortName}, ${institution.city}`;

  return (
    <html lang="en-NG">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <Shell user={user} unreadCount={unread} campusLabel={campusLabel}>
            {children}
          </Shell>
        </Providers>
      </body>
    </html>
  );
}
