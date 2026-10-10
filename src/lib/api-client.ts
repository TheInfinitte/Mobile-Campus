/**
 * src/lib/api-client.ts
 * WHAT: The browser-side helper for sending data to our API routes - POST, PUT,
 *       PATCH and DELETE - and getting back `{ ok, data, error }`.
 * WHY : Every form in the app does the same four things: send JSON, check the
 *       status, read the error message, and cope with being offline. Doing that
 *       once means no form forgets one of them.
 *
 * WHY THIS IS NOT IN src/hooks: it is an ordinary async function, not a React
 * hook - it uses no state and no effects. Naming it `useApi` made ESLint's
 * rules-of-hooks check reject every call site, because React reserves the `use`
 * prefix for real hooks. `sendApi` is an honest name.
 */
"use client";

/** The shape of every API response: either { data } or { error }. */
type ApiEnvelope<T> = { data?: T; error?: string };

/** What every caller gets back, whatever happened. */
export type SendApiResult<T> = {
  ok: boolean;
  data: T | null;
  /** A message safe to show the user - never a stack trace. */
  error: string;
};

/**
 * sendApi
 * WHAT: Sends one request and always resolves - it never throws.
 * WHY : A form handler that throws leaves a spinner running forever. Returning a
 *       result object means the caller can always clear its loading state.
 *
 * `credentials: "same-origin"` is what sends the session cookie, so the API
 * knows who is signed in.
 */
export async function sendApi<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<SendApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      // Omit the body entirely for methods that do not carry one.
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });

    // A non-JSON response (a proxy error page, for example) must not crash us.
    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

    if (!response.ok || payload.error) {
      return {
        ok: false,
        data: null,
        error: payload.error ?? `Request failed (${response.status})`,
      };
    }

    return { ok: true, data: (payload.data as T) ?? null, error: "" };
  } catch {
    // Almost always means the phone has no signal.
    return { ok: false, data: null, error: "Could not reach the server. Check your connection." };
  }
}
