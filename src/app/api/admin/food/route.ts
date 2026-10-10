/**
 * src/app/api/admin/food/route.ts
 * WHAT: The admin side of the food directory - see suggested spots, approve
 *       them onto the board, remove bad ones, and manage sponsored slots.
 * WHY : Student suggestions keep the directory fresh, but a real person must
 *       check every spot before the public sees it. Sponsorship is the
 *       directory's monetisation hook, so admins control it here too.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, adminFoodDecisionSchema } from "@/lib/validators";

/**
 * GET /api/admin/food?status=SUGGESTED|ALL
 * SUGGESTED (default) = the approval queue. ALL = every spot for management.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const raw = new URL(request.url).searchParams.get("status") ?? "SUGGESTED";
    // Anything unexpected falls back to the queue view - never the full list.
    const status = (["SUGGESTED", "ACTIVE", "REMOVED", "ALL"] as const).includes(raw as "ALL")
      ? (raw as "SUGGESTED" | "ACTIVE" | "REMOVED" | "ALL")
      : "SUGGESTED";

    const vendors = await prisma.foodVendor.findMany({
      where: status === "ALL" ? {} : { status: status },
      orderBy: [{ createdAt: "asc" }],
      include: {
        suggestedBy: { select: { fullName: true, phone: true } },
        institution: { select: { shortName: true } },
        _count: { select: { reviews: true } },
      },
    });

    return json({
      vendors: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        description: vendor.description,
        categories: vendor.categories,
        priceMinKobo: vendor.priceMinKobo,
        priceMaxKobo: vendor.priceMaxKobo,
        whatsAppNumber: vendor.whatsAppNumber,
        websiteUrl: vendor.websiteUrl,
        area: vendor.area,
        status: vendor.status,
        adminNote: vendor.adminNote,
        isSponsored: vendor.isSponsored,
        suggestedBy: vendor.suggestedBy,
        institution: vendor.institution,
        reviewCount: vendor._count.reviews,
        createdAt: vendor.createdAt,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/admin/food
 * Body: { id, decision: APPROVE|REMOVE|ACTIVATE|SPONSOR|UNSPONSOR, adminNote? }
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await readJson(request);
    const parsed = safeParse(adminFoodDecisionSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const vendor = await prisma.foodVendor.findUnique({ where: { id: parsed.data.id } });
    if (!vendor) return fail("That food spot no longer exists.", 404);

    const { decision, adminNote } = parsed.data;

    switch (decision) {
      case "APPROVE":
        // A suggestion passes the check and goes live on the directory.
        await prisma.foodVendor.update({
          where: { id: vendor.id },
          data: { status: "ACTIVE", adminNote: adminNote ?? null },
        });
        break;
      case "REMOVE":
        // Hidden from the public; the record stays for moderation history.
        await prisma.foodVendor.update({
          where: { id: vendor.id },
          data: { status: "REMOVED", isSponsored: false, adminNote: adminNote ?? null },
        });
        break;
      case "ACTIVATE":
        // Bring a removed spot back onto the board.
        await prisma.foodVendor.update({ where: { id: vendor.id }, data: { status: "ACTIVE" } });
        break;
      case "SPONSOR":
        // Paid top slot - expires in 30 days so nobody sponsors forever.
        await prisma.foodVendor.update({
          where: { id: vendor.id },
          data: { isSponsored: true, sponsoredUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        });
        break;
      case "UNSPONSOR":
        await prisma.foodVendor.update({
          where: { id: vendor.id },
          data: { isSponsored: false, sponsoredUntil: null },
        });
        break;
    }

    const updated = await prisma.foodVendor.findUnique({ where: { id: vendor.id } });
    return json({ id: vendor.id, status: updated?.status, isSponsored: updated?.isSponsored });
  } catch (error) {
    return handleError(error);
  }
}
