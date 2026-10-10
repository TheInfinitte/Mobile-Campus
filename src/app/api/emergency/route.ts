/**
 * src/app/api/emergency/route.ts
 * WHAT: The "Urgent 2k" goodwill board - read your own requests and goodwill
 *       record, and post a new anonymous request for help.
 * WHY : The platform is never a lender here. It does exactly three things:
 *       verify who you are, keep your request anonymous, and make sure the
 *       bank account that receives support belongs to the same legal person
 *       as the student ID on file.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, goodwillRequestSchema } from "@/lib/validators";
import {
  applyExpiredCommitments,
  assertCanUseBoard,
  banUntil,
  createRequest,
  getRecord,
  namesMatch,
} from "@/lib/goodwill";

/**
 * GET /api/emergency
 * Returns: the student's own requests (including what a committed helper is
 * doing), their private goodwill record, and whether the board is locked for
 * them. Bank details are never included in a list response.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    // Lazy sweep: expired commitments are settled on read, so a snooper's
    // 7-day pause starts the moment their window closes.
    await applyExpiredCommitments(user.id);

    const [record, requests] = await Promise.all([
      getRecord(user.id),
      prisma.goodwillRequest.findMany({
        where: { requesterId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          alias: true,
          story: true,
          amountKobo: true,
          status: true,
          activeHelpId: true,
          receivedAt: true,
          closedAt: true,
          createdAt: true,
          helps: {
            select: {
              id: true,
              status: true,
              committedAt: true,
              expiresAt: true,
              sentAt: true,
              confirmedAt: true,
              note: true,
              helper: { select: { fullName: true, avatarUrl: true } },
            },
            orderBy: { committedAt: "desc" },
          },
        },
      }),
    ]);

    const until = banUntil(record);

    return json({
      requests,
      record: {
        helpsCompleted: record.helpsCompleted,
        helpsAbandoned: record.helpsAbandoned,
        requestsReceived: record.requestsReceived,
        // null when the student is free to use the board.
        boardBannedUntil: until,
        banReason: until ? record.banReason : null,
      },
      canUseBoard: until === null,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/emergency
 * Body: { amountKobo, story, bankName, bankAccountNumber, bankAccountName,
 *         consent: true }
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    // STUDENT ID LOCK: only a fully verified student (admin-checked ID card)
    // may ask the board for help - and only students.
    if (user.role !== "STUDENT") return fail("The support board is for students.", 403);
    if (!user.isVerified) {
      return fail("Upload and verify your student ID first - it takes a few minutes.", 403);
    }

    // Board gate: a student currently serving a 7-day pause cannot post.
    // Throws an ApiError, which handleError turns into a 403 with the reason.
    await assertCanUseBoard(user.id);

    // One open request at a time keeps the board honest and readable.
    const existing = await prisma.goodwillRequest.findFirst({
      where: { requesterId: user.id, status: { in: ["OPEN", "COMMITTED", "SENT"] } },
      select: { id: true },
    });
    if (existing) return fail("You already have a request on the board. Close it before posting another.", 409);

    const body = await readJson(request);
    const parsed = safeParse(goodwillRequestSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    // ACCOUNT NAME ENFORCEMENT: the account that receives support must belong
    // to the same legal person as the verified ID. Without this, a student
    // could point the board at a third party's account.
    if (!namesMatch(parsed.data.bankAccountName, user.fullName)) {
      return fail(
        `The bank account name must match the legal name on your student ID ("${user.fullName}"). Third-party accounts cannot receive support.`,
        400
      );
    }

    const created = await createRequest({
      requesterId: user.id,
      institutionId: user.institutionId,
      story: parsed.data.story,
      amountKobo: parsed.data.amountKobo,
      bankName: parsed.data.bankName,
      bankAccountNumber: parsed.data.bankAccountNumber,
      bankAccountName: parsed.data.bankAccountName,
    });

    return json({ id: created.id, alias: created.alias, status: created.status }, 201);
  } catch (error) {
    return handleError(error);
  }
}
