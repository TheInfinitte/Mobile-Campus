/**
 * src/lib/utils.ts
 * WHAT: Small helpers used across the whole app - dates, distances, links and
 *       text formatting.
 * WHY : These appear on almost every screen, so they live in one shared file
 *       instead of being copy-pasted.
 */

/**
 * formatNairaDate
 * WHAT: Formats a date the Nigerian way, e.g. "Sat, 14 Sep 2026".
 * WHY : Users must instantly understand viewing dates and due dates.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/**
 * formatDateTime
 * WHAT: Date plus time, e.g. "Sat, 14 Sep 2026, 2:30 pm".
 * WHY : Viewing appointments need a time.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * timeAgo
 * WHAT: "3 minutes ago", "2 hours ago", "5 days ago".
 * WHY : Marketplace and gig listings feel alive when they show fresh activity.
 */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/**
 * walkTime
 * WHAT: Turns metres into a friendly walking time, e.g. 900 -> "11 min walk".
 * WHY : Students care about "how far is it from the gate", not metres.
 *       We assume a relaxed 80 metres per minute walking pace.
 */
export function walkTime(meters: number | null | undefined): string {
  if (!meters || meters <= 0) return "Distance not listed";
  const minutes = Math.max(1, Math.round(meters / 80));
  if (minutes < 15) return `${minutes} min walk`;
  // Over 15 minutes, most students take a bike ("okada") or a keke.
  return `${minutes} min walk / short ride`;
}

/**
 * distanceLabel
 * WHAT: Shows the raw distance for users who want the number.
 * WHY : The filter shows "Under 1km", so the card should agree with it.
 */
export function distanceLabel(meters: number | null | undefined): string {
  if (!meters) return "Not listed";
  if (meters < 1000) return `${meters}m from the gate`;
  return `${(meters / 1000).toFixed(1)}km from the gate`;
}

/**
 * whatsappLink
 * WHAT: Builds a wa.me link that opens WhatsApp with a message already typed.
 * WHY : The "Chat on WhatsApp" button is the fastest way a student reaches a
 *       caretaker in Nigeria - no in-app chat server needed.
 */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("234") ? digits : digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

/**
 * telLink
 * WHAT: A tel: link for one-tap calling on mobile.
 * WHY : Not every caretaker uses WhatsApp.
 */
export function telLink(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

/**
 * initials
 * WHAT: Up to two letters from a name, e.g. "Chidera Okafor" -> "CO".
 * WHY : Avatars are optional; initials always work and cost no data.
 */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * truncate
 * WHAT: Cuts long text and adds an ellipsis.
 * WHY : Cards have limited height on a 360px screen.
 */
export function truncate(text: string, max = 120): string {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}...`;
}

/**
 * cn
 * WHAT: Joins class names, skipping false/undefined values.
 * WHY : Conditional Tailwind classes get messy inline; this keeps JSX readable.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * sleep
 * WHAT: Waits for a number of milliseconds.
 * WHY : Used by the celebration animation so the confetti has time to play.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * slugify
 * WHAT: Turns a title into a URL-safe string.
 * WHY : Used for share links and image file names.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * safeJsonParse
 * WHAT: Parses JSON without throwing.
 * WHY : Several columns store JSON as text. A corrupt row must not crash a page.
 */
export function safeJsonParse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
