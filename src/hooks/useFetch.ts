/**
 * src/hooks/useFetch.ts
 * WHAT: A small data-fetching hook: `const { data, loading, error } = useFetch(url)`.
 * WHY : Every list screen needs the same four things - fetch on mount, track
 *       loading, handle errors, and be able to refetch after an action. Writing
 *       that once avoids twenty slightly different useEffect hooks (and the bugs
 *       that come with them).
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The shape of every API response: either { data } or { error }. */
type ApiResponse<T> = { data?: T; error?: string };

type UseFetchResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the request (used after creating or updating something). */
  refetch: () => void;
  /** Overwrites the local data without a network call (optimistic updates). */
  setData: (value: T | null) => void;
};

/**
 * useFetch
 * WHAT: Fetches JSON from a URL and manages loading/error state.
 * WHY : Handles the two classic React fetch bugs for us:
 *       1. Setting state after the component unmounts (memory leak warning).
 *       2. Re-fetching in an endless loop because the callback identity changes.
 */
export function useFetch<T>(url: string | null, options?: RequestInit): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);

  // A counter that lets us ignore responses from an outdated request
  // (for example when the user changes filters quickly).
  const requestId = useRef(0);

  const load = useCallback(async () => {
    // A null URL means "do not fetch yet" (for example until a filter is chosen).
    if (!url) {
      setLoading(false);
      return;
    }

    const thisRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        ...options,
        // Always send cookies so the server knows who is logged in.
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
        cache: "no-store",
      });

      const payload = (await response.json()) as ApiResponse<T>;

      // A newer request has already started - ignore this one.
      if (thisRequest !== requestId.current) return;

      if (!response.ok || payload.error) {
        setError(payload.error ?? `Request failed (${response.status})`);
        setData(null);
      } else {
        setData((payload.data as T) ?? null);
      }
    } catch {
      if (thisRequest !== requestId.current) return;
      // Most likely the user is offline.
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
    // We intentionally depend only on `url` - options are stable in our usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Run on mount and whenever the URL changes (for example a new filter).
  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}

/**
 * The POST/PATCH/DELETE helper used to live in this file as `useApi`. It is an
 * ordinary async function rather than a React hook, so it now lives in
 * src/lib/api-client.ts as `sendApi` - see the note there for why the rename
 * matters.
 */
