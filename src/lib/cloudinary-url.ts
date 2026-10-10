/**
 * src/lib/cloudinary-url.ts
 * WHAT: The pure Cloudinary URL helpers - rewriting a Cloudinary URL so the CDN
 *       serves a compressed, resized version of the same image.
 * WHY : This file imports nothing at all, so a client component can use it
 *       safely. The rest of the Cloudinary logic (src/lib/cloudinary.ts) reads
 *       secret environment variables and calls the Cloudinary API, and must stay
 *       on the server. Splitting the two is what stops a phone from ever
 *       downloading an API key.
 */

/**
 * optimisedUrl
 * WHAT: Rewrites a Cloudinary URL to include an automatic-format, automatic-
 *       quality transformation capped at `width` pixels wide.
 * WHY : A phone photo is often 4000px wide and several megabytes. A student on a
 *       mobile-data connection should never download that just to see a room
 *       thumbnail. `/upload/f_auto,q_auto:good,w_900/` makes Cloudinary deliver
 *       WebP or AVIF at the right size instead - typically a tenth of the bytes.
 *
 * Returns the URL untouched when it is empty, when it is not a Cloudinary URL
 * (for example a seed placeholder image), or when a transformation is already
 * present - so calling it twice is harmless.
 */
export function optimisedUrl(url: string, width = 900): string {
  if (!url) return url;
  if (!url.includes("res.cloudinary.com")) return url;

  // Already transformed - do not stack a second transformation on top.
  if (url.includes("/upload/f_auto")) return url;

  return url.replace("/upload/", `/upload/f_auto,q_auto:good,w_${width},c_limit/`);
}

/**
 * thumbUrl
 * WHAT: A small square version of the same image, cropped to fill.
 * WHY : Lists show many small images at once. `c_fill` crops to an exact square
 *       so a grid of lodge cards lines up instead of showing ragged heights.
 */
export function thumbUrl(url: string, size = 200): string {
  if (!url) return url;
  if (!url.includes("res.cloudinary.com")) return url;

  return url.replace("/upload/", `/upload/f_auto,q_auto:good,w_${size},h_${size},c_fill/`);
}

/**
 * isAllowedImage
 * WHAT: Sanity-checks an uploaded image URL before we save it.
 * WHY : A user controls the URL they send us. Without this check someone could
 *       save a `javascript:` URL (which executes when clicked) or a link to a
 *       private file on another Cloudinary account. Only HTTPS URLs on
 *       res.cloudinary.com are accepted.
 */
export function isAllowedImage(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
  } catch {
    // Not a valid URL at all.
    return false;
  }
}
