/**
 * src/app/api/admin/fees/route.ts
 * WHAT: Lists the FeeConfig rows and lets an admin edit them.
 * WHY : Fees must never be hard-coded. This endpoint is the ONLY way fees change,
 *       and every pricing calculation reads the result. Changing the escrow fee
 *       from 3% to 2.5% is a one-field edit here, with no redeploy.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { clearFeeCache } from "@/lib/fees";
import { notify } from "@/lib/notifications";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, feeConfigSchema } from "@/lib/validators";

/**
 * GET /api/admin/fees
 * Admin only. Returns every fee rule, active or not.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();

    const fees = await prisma.feeConfig.findMany({ orderBy: { key: "asc" } });
    return json({ fees });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PUT /api/admin/fees
 * Body: { key, label, percent, fixedKobo, minimumKobo, maximumKobo, payer, isActive }
 * Creates or updates one fee rule (upsert on the unique `key`).
 */
export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    const body = await readJson(request);
    const parsed = safeParse(feeConfigSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const data = parsed.data;

    // Sanity checks that stop an admin from wrecking the business by accident.
    if (data.minimumKobo > 0 && data.maximumKobo > 0 && data.minimumKobo > data.maximumKobo) {
      return fail("The minimum fee cannot be higher than the maximum fee.", 400);
    }
    if (data.percent > 10) {
      return fail("A fee above 10% is not allowed - students would never accept it.", 400);
    }

    const fee = await prisma.feeConfig.upsert({
      where: { key: data.key },
      update: {
        label: data.label,
        percent: data.percent,
        fixedKobo: data.fixedKobo,
        minimumKobo: data.minimumKobo,
        maximumKobo: data.maximumKobo,
        payer: data.payer,
        isActive: data.isActive,
      },
      create: {
        key: data.key,
        type: data.key.includes("HOUSING_TENANT")
          ? "HOUSING_TENANT"
          : data.key.includes("HOUSING_LANDLORD")
            ? "HOUSING_LANDLORD"
            : data.key === "TRANSFER"
              ? "TRANSFER"
              : "ESCROW",
        label: data.label,
        percent: data.percent,
        fixedKobo: data.fixedKobo,
        minimumKobo: data.minimumKobo,
        maximumKobo: data.maximumKobo,
        payer: data.payer,
        isActive: data.isActive,
      },
    });

    // CRITICAL: drop the in-memory fee cache so the new values are used
    // immediately, not after 60 seconds.
    clearFeeCache();

    // Record the change for the admin's own audit trail.
    await notify({
      userId: admin.id,
      title: "Fee configuration updated",
      body: `${data.label} is now ${data.percent}% (minimum ₦${data.minimumKobo / 100}). The change is live.`,
      link: "/admin/fees",
    });

    return json({ fee });
  } catch (error) {
    return handleError(error);
  }
}
