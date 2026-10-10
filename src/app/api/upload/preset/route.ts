/**
 * src/app/api/upload/preset/route.ts
 * WHAT: Returns the Cloudinary cloud name and unsigned upload preset that the
 *       browser needs to upload an image directly.
 * WHY : We must never put CLOUDINARY_API_SECRET in the browser bundle. An
 *       unsigned preset is public but restricted (folder, size limits, allowed
 *       formats) so it is safe to hand out.
 */
import { NextResponse } from "next/server";
import { json, fail, handleError } from "@/lib/api";
import { cloudinaryConfig } from "@/lib/cloudinary";

/**
 * GET /api/upload/preset
 * Returns: { data: { cloudName, uploadPreset } }
 */
export async function GET(): Promise<NextResponse> {
  try {
    const config = cloudinaryConfig();

    if (!config.cloudName || !config.uploadPreset) {
      return fail(
        "Image upload is not configured yet. Add CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET to your .env file.",
        503
      );
    }

    return json(config);
  } catch (error) {
    return handleError(error);
  }
}
