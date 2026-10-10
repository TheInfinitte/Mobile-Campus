/**
 * src/lib/cloudinary.ts
 * WHAT: Server-side helper for Cloudinary uploads and signed URLs.
 * WHY : Every photo on Mobile Campus is a student ID card, a landlord document,
 *       a lodge photo or an item photo. They must be compressed automatically
 *       (phones have slow data) and served from a CDN.
 *
 * UPLOAD FLOW USED IN THIS APP:
 *   1. The browser asks GET /api/upload/preset for the cloud name + unsigned
 *      preset (no secret key is ever exposed).
 *   2. The browser uploads the image straight to Cloudinary, which compresses
 *      and resizes it using the preset's transformation settings.
 *   3. The browser sends the returned secure_url back to our API to save it.
 *
 * For extra safety this file also exposes a server-side proxy upload that
 * accepts an image and re-uploads it with forced compression.
 */
import { env } from "./env";
import { ApiError } from "./auth";

/** Cloudinary's unsigned upload endpoint (no API key needed in the URL). */
export const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";

/**
 * cloudinaryConfig
 * WHAT: The public, non-secret settings the browser needs to upload.
 * WHY : Returned by /api/upload/preset so we never ship an API key to a phone.
 */
export function cloudinaryConfig(): { cloudName: string; uploadPreset: string } {
  return {
    cloudName: env.cloudinary.cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
    uploadPreset: env.cloudinary.uploadPreset || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "",
  };
}

// The pure URL helpers live in cloudinary-url.ts so client components can use
// them without pulling our environment variables into the browser bundle. They
// are re-exported here so server code can keep importing from "@/lib/cloudinary".
export { optimisedUrl, thumbUrl, isAllowedImage } from "./cloudinary-url";

/**
 * serverSideUpload
 * WHAT: Uploads an image from our server to Cloudinary using the signed
 *       endpoint, forcing compression.
 * WHY : Used by the server-side proxy route when we do not want the browser to
 *       talk to Cloudinary directly (for example admin re-processing a document).
 */
export async function serverSideUpload(input: {
  fileBase64: string;      // Data URL, e.g. "data:image/jpeg;base64,..."
  folder: string;          // e.g. "verifications", "lodges", "market"
  apiKey: string;
  apiSecret: string;
}): Promise<{ url: string; publicId: string }> {
  const { cloudName } = cloudinaryConfig();
  if (!cloudName) throw new ApiError(500, "Cloudinary is not configured.");

  const form = new FormData();
  form.append("file", input.fileBase64);
  form.append("folder", input.folder);
  // Force compression: automatic format (WebP/AVIF) and automatic quality.
  form.append("transformation", "f_auto,q_auto,w_1600");
  form.append("api_key", input.apiKey);

  const response = await fetch(`${CLOUDINARY_UPLOAD_URL}/${cloudName}/image/upload`, {
    method: "POST",
    headers: {
      // Basic auth with the API key/secret pair (server-side only).
      Authorization: `Basic ${Buffer.from(`${input.apiKey}:${input.apiSecret}`).toString("base64")}`,
    },
    body: form,
    cache: "no-store",
  });

  const data = (await response.json()) as { secure_url?: string; public_id?: string; error?: { message: string } };

  if (!response.ok || !data.secure_url) {
    throw new ApiError(502, data.error?.message ?? "Image upload failed.");
  }

  return { url: data.secure_url, publicId: data.public_id ?? "" };
}
