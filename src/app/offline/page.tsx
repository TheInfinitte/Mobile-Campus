/**
 * src/app/offline/page.tsx
 * WHAT: The page shown when the user has no internet connection.
 * WHY : The service worker serves this from the cache when a navigation fails.
 *       A friendly, branded screen beats the browser's error page and tells the
 *       student exactly what to do.
 */
import { PageTransition } from "@/components/motion/PageTransition";
import { RefreshIcon } from "@/components/ui/Icons";

export const metadata = { title: "You are offline" };

/**
 * OfflinePage
 * WHAT: A simple centred message with a retry button.
 * WHY : The retry button reloads the page - the moment the connection returns,
 *       one tap gets them back into the app.
 */
export default function OfflinePage() {
  return (
    <PageTransition className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* An offline icon drawn in CSS so it works with no assets. */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 8.8a15 15 0 0 1 5-3.3M22 8.8a15 15 0 0 0-6.4-3.6" />
            <path d="M5.5 12.5a10 10 0 0 1 3-2M18.5 12.5a10 10 0 0 0-3.6-2.1" />
            <path d="M8.8 16a5 5 0 0 1 4.5-1" />
            <path d="M12 19.5h.01" />
            <path d="m3 3 18 18" stroke="#dc2626" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-slate-900">You are offline</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your connection dropped. Prices and listings change often, so we do not show old data - reconnect and we will load
          everything fresh.
        </p>

        {/* A plain link with a client-side reload. Using an <a> keeps this page a
            server component while still working offline. */}
        <a href="/" className="mc-btn-primary mt-6 w-full">
          <RefreshIcon size={16} />
          Try again
        </a>

        <p className="mt-4 text-[11px] text-slate-400">
          Tip: pages you have already visited may still open from your phone&apos;s cache.
        </p>
      </div>
    </PageTransition>
  );
}
