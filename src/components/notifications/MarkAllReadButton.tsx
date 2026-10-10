/**
 * src/components/notifications/MarkAllReadButton.tsx
 * WHAT: A small button that marks every in-app notification as read.
 * WHY : Clearing 30 notifications one by one on a phone is miserable, so there is
 *       one tap for the whole list.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendApi } from "@/lib/api-client";
import { CheckIcon } from "@/components/ui/Icons";

/**
 * MarkAllReadButton
 * WHAT: Sends the mark-all-read request and refreshes the page.
 */
export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  /** Calls the API, then re-renders the server list. */
  async function markAll() {
    setLoading(true);
    await sendApi("/api/notifications", "PATCH", { all: true });
    router.refresh();
    setLoading(false);
  }

  return (
    <button type="button" onClick={markAll} disabled={loading} className="mc-chip disabled:opacity-50">
      <CheckIcon size={14} />
      {loading ? "Working..." : "Mark all read"}
    </button>
  );
}
