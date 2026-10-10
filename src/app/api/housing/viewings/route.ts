/**
 * src/app/api/housing/viewings/route.ts
 * WHAT: Creates a viewing request (a student asking to come and see a lodge) and
 *       lists the signed-in user's requests.
 * WHY : Viewing before paying is how Nigerian students actually rent. A structured
 *       request with a date beats a missed phone call, and it gives the caretaker
 *       something to confirm.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { sendSms, viewingRequestMessage } from "@/lib/termii";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, viewingRequestSchema } from "@/lib/validators";
import { formatDateTime } from "@/lib/utils";

/**
 * GET /api/housing/viewings
 * Returns the requests the signed-in user made (student) or received (landlord).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    // Landlords see requests for THEIR lodges; students see their own.
    const requests =
      user.role === "LANDLORD"
        ? await prisma.viewingRequest.findMany({
            where: { lodge: { landlordId: user.id } },
            include: {
              user: { select: { fullName: true, phone: true, avatarUrl: true, verificationStatus: true } },
              lodge: { select: { id: true, title: true, area: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : await prisma.viewingRequest.findMany({
            where: { userId: user.id },
            include: {
              lodge: { select: { id: true, title: true, area: true, caretakerName: true, caretakerPhone: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          });

    return json({ requests });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/housing/viewings
 * Body: { lodgeId, preferredDate, message? }
 * Returns: { data: { id, status } }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(viewingRequestSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // Stop spam: 10 viewing requests per day per user.
    const limit = rateLimit(`viewing:${user.id}`, 10, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      return fail("You have sent a lot of viewing requests today. Please wait for replies.", 429);
    }

    const lodge = await prisma.lodge.findUnique({
      where: { id: parsed.data.lodgeId },
      include: { landlord: { select: { id: true, fullName: true, phone: true } } },
    });

    if (!lodge || lodge.status !== "ACTIVE") {
      return fail("That listing is not available.", 404);
    }

    // A viewing date must be in the future.
    if (parsed.data.preferredDate.getTime() < Date.now()) {
      return fail("Please choose a date and time in the future.", 400);
    }

    // Do not allow two open requests for the same lodge from one person.
    const existing = await prisma.viewingRequest.findFirst({
      where: { userId: user.id, lodgeId: lodge.id, status: { in: ["REQUESTED", "CONFIRMED"] } },
    });
    if (existing) {
      return fail("You already have a viewing request for this lodge.", 409);
    }

    const viewing = await prisma.viewingRequest.create({
      data: {
        lodgeId: lodge.id,
        userId: user.id,
        preferredDate: parsed.data.preferredDate,
        message: parsed.data.message,
        status: "REQUESTED",
      },
    });

    // Tell the student their request was recorded.
    await notify({
      userId: user.id,
      title: "Viewing request sent",
      body: `${lodge.caretakerName ?? lodge.landlord.fullName} will confirm a time for ${lodge.title}.`,
      link: `/housing/${lodge.id}`,
    });

    // Tell the caretaker, by in-app notification AND SMS (they may not be online).
    await notify({
      userId: lodge.landlord.id,
      title: "New viewing request",
      body: `${user.fullName} wants to view "${lodge.title}" on ${formatDateTime(parsed.data.preferredDate)}.`,
      link: "/landlord",
      sms: true,
      smsBody: viewingRequestMessage(
        lodge.landlord.fullName.split(" ")[0],
        lodge.title,
        user.fullName,
        formatDateTime(parsed.data.preferredDate)
      ),
    });

    // A fallback SMS if the notification channel failed silently.
    void sendSms;

    return json({ id: viewing.id, status: viewing.status }, 201);
  } catch (error) {
    return handleError(error);
  }
}
