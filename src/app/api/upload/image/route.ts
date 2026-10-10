/**
 * src/app/api/upload/image/route.ts
 * WHAT: A server-side upload proxy. It accepts a base64 image, re-uploads it to
 *       Cloudinary with forced compression, and returns the URL.
 * WHY : Two uses:
 *       1. Devices whose browser cannot run the canvas compression (old Android
 *          WebView) still get a compressed upload.
 *       2. Admins re-processing a document image.
 *
 * LIMITS: 6MB per request, one image at a time, and rate limited - otherwise
 * this endpoint would be an expensive way to host random files.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { serverSideUpload } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { readJson, fail, json, handleError } from "@/lib/api";

/** Largest base64 payload we accept (~6MB of image data). */
const MAX_BASE64_LENGTH = 8_400_000;

/** Folders a caller is allowed to upload into. */
const ALLOWED_FOLDERS = ["verifications", "lodges", "market", "disputes", "avatars", "checklists"];

/**
 * POST /api/upload/image
 * Body: { fileBase64: "data:image/jpeg;base64,...", folder: "market" }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = (await readJson(request)) as { fileBase64?: string; folder?: string };

    if (!body.fileBase64 || !body.fileBase64.startsWith("data:image/")) {
      return fail("Please send an image file.", 400);
    }
    if (body.fileBase64.length > MAX_BASE64_LENGTH) {
      return fail("That image is too large. Please use a photo under 6MB.", 413);
    }

    const folder = body.folder ?? "uploads";
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return fail("That upload folder is not allowed.", 400);
    }

    // 20 uploads per hour per user.
    const limit = rateLimit(`upload:${user.id}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return fail("You have uploaded a lot of images recently. Please try again later.", 429);

    // The signed Cloudinary credentials live only in the server environment.
    const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
    const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";
    if (!apiKey || !apiSecret) {
      return fail("Server-side image upload is not configured. Use the direct browser upload instead.", 503);
    }

    void env; // Keeps the env module part of this route's surface for future use.

    const result = await serverSideUpload({
      fileBase64: body.fileBase64,
      folder,
      apiKey,
      apiSecret,
    });

    return json({ url: result.url, publicId: result.publicId }, 201);
  } catch (error) {
    return handleError(error);
  }
}
