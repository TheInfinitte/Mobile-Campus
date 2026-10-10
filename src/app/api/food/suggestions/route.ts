/**
 * src/app/api/food/suggestions/route.ts
 * WHAT: Lets a verified student suggest a new food spot, and lists their own
 *       suggestions so they can see what is pending.
 * WHY : The directory is community-curated: students know the best buka around
 *       the gate long before any admin does. Every suggestion waits for an
 *       admin check before it appears publicly.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, foodSuggestionSchema } from "@/lib/validators";

/**
 * GET /api/food/suggestions
 * Returns the signed-in student's own suggestions with their review status.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const suggestions = await prisma.foodVendor.findMany({
      where: { suggestedById: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, adminNote: true, createdAt: true },
    });
    return json({ suggestions });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/food/suggestions
 * Body: { name, description, categories, priceMinKobo, priceMaxKobo,
 *         whatsAppNumber, websiteUrl?, area }
 * Creates the spot with status SUGGESTED - it goes live only after approval.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only students can suggest food spots.", 403);
    // Trust rule: an unverified account must not seed public content.
    if (!user.isVerified) return fail("Verify your student status before suggesting spots.", 403);

    const body = await readJson(request);
    const parsed = safeParse(foodSuggestionSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // A price range that runs backwards is a typo, not a bargain.
    if (parsed.data.priceMaxKobo < parsed.data.priceMinKobo) {
      return fail("The highest price cannot be lower than the lowest price.", 400);
    }

    // Block duplicate names at the same campus so the queue stays clean.
    const duplicate = await prisma.foodVendor.findFirst({
      where: { institutionId: user.institutionId, name: { equals: parsed.data.name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return fail("That food spot has already been suggested. Thank you!", 409);

    const vendor = await prisma.foodVendor.create({
      data: {
        institutionId: user.institutionId,
        suggestedById: user.id,
        name: parsed.data.name.trim(),
        description: parsed.data.description,
        categories: parsed.data.categories,
        priceMinKobo: parsed.data.priceMinKobo,
        priceMaxKobo: parsed.data.priceMaxKobo,
        whatsAppNumber: parsed.data.whatsAppNumber.trim(),
        websiteUrl: parsed.data.websiteUrl || null,
        area: parsed.data.area,
        status: "SUGGESTED",
      },
    });

    return json({ id: vendor.id, status: vendor.status }, 201);
  } catch (error) {
    return handleError(error);
  }
}
