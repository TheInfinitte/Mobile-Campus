/**
 * src/components/layout/LogoutButton.tsx
 * WHAT: A small "Sign out" button that clears the session cookie.
 * WHY : Logging out has to be a browser action (it clears a cookie and then
 *       forces a full reload), so it cannot live inside a server component.
 */
"use client";

import { useState } from "react";
import { sendApi } from "@/lib/api-client";
import { LogoutIcon } from "@/components/ui/Icons";

/**
 * LogoutButton
 * WHAT: Calls the logout route, then hard-navigates home.
 * WHY : A hard navigation (window.location) wipes every cached client component,
 *       which guarantees no signed-in UI is left on screen.
 */
export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  /** Signs out and returns to the home screen. */
  async function logout() {
    setLoading(true);
    await sendApi("/api/auth/logout", "POST", {});
    // window.location.href forces a real page load, so React's cache is discarded.
    window.location.href = "/";
  }

  return (
    <button type="button" onClick={logout} disabled={loading} className="mc-btn-ghost text-danger-dark disabled:opacity-50">
      <LogoutIcon size={14} />
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
