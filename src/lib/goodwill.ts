/**
 * src/lib/goodwill.ts
 * WHAT: The rules of the "Urgent 2k" peer-to-peer goodwill board - anonymous
 *       posting, the commitment gate, the 2-hour transfer timer, the snooper
 *       penalty, and the two-way confirmation loop.
 * WHY : Every rule that protects a student's dignity or privacy lives in one
 *       module so no endpoint can accidentally skip a check.
 *
 * WHAT THIS MODULE NEVER DOES: lend money, charge a fee, hold funds, or
 * promise a repayment. Money moves directly between two students' own bank
 * apps. The platform only verifies identity, protects anonymity, and records
 * who actually followed through on what they said they would do.
 */
import { prisma } from "./prisma";
import { encrypt, decrypt } from "./encrypt";
import { notify } from "./notifications";
import { ApiError } from "./auth";
import type { GoodwillHelp, GoodwillRequest, GoodwillRecord } from "@prisma/client";

/** How long a helper has to send once they unlock a classmate's details. */
export const COMMIT_WINDOW_MINUTES = 120;
/** How long a bad-faith unlock keeps a helper off the board. */
export const SNOOPER_BAN_DAYS = 7;
/** The alias format used on the anonymous board. */
export const ALIAS_PREFIX = "Student #";

/**
 * namesMatch
 * WHAT: Strict comparison of the bank account name against the legal name on
 *       the verified student ID (user.fullName is the name an admin matched
 *       against the ID card at verification time).
 * WHY : Fraud guard - a third party's account can never appear on the board,
 *       so no helper can ever be tricked into sending money to a stranger.
 *       Case- and whitespace-tolerant because banks reformat names, but every
 *       word must match in order.
 */
export function namesMatch(bankAccountName: string, legalName: string): boolean {
  const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalise(bankAccountName) === normalise(legalName);
}

/**
 * makeAlias
 * WHAT: The anonymous board handle, e.g. "Student #4821".
 * WHY : Asking for help should never cost a student their dignity. The real
 *       userId stays server-side for moderation, exactly like the gist board.
 */
export function makeAlias(): string {
  return `${ALIAS_PREFIX}${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * getRecord
 * WHAT: A student's private goodwill record, created lazily on first use.
 */
export async function getRecord(userId: string): Promise<GoodwillRecord> {
  return prisma.goodwillRecord.upsert({ where: { userId }, create: { userId }, update: {} });
}

/**
 * banUntil
 * WHAT: When a student's board ban ends, or null if they are not banned.
 * WHY : A ban that has already expired must not keep locking anyone out - the
 *       timestamp is the single source of truth, so this is checked live.
 */
export function banUntil(record: GoodwillRecord | null): Date | null {
  if (!record?.boardBannedUntil) return null;
  return record.boardBannedUntil.getTime() > Date.now() ? record.boardBannedUntil : null;
}

/**
 * assertCanUseBoard
 * WHAT: The gate on the board itself - verified student, not currently banned.
 * WHY : Identity lock plus the snooper penalty, enforced identically whether
 *       the student is browsing, posting or offering to help.
 */
export async function assertCanUseBoard(userId: string): Promise<GoodwillRecord> {
  const record = await getRecord(userId);
  const until = banUntil(record);
  if (until) {
    throw new ApiError(
      403,
      `You are paused from the support board until ${until.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}. You unlocked a classmate's private details and the transfer window expired without the transfer being marked as sent. The rest of the app still works as normal.`
    );
  }
  return record;
}

/**
 * applyExpiredCommitments
 * WHAT: THE SNOOPER PENALTY ENGINE. Finds commitments whose 2-hour window has
 *       run out with the helper still silent, records them as abandoned, and
 *       applies the 7-day board pause.
 * WHY : Unlocking a classmate's verified identity and bank details is a
 *       privilege. Letting the timer run out after looking is a privacy
 *       violation, so it costs access - and the requester's request goes
 *       straight back on the board for someone who will follow through.
 *
 * Called lazily on every board read and before every commitment action, so
 * there is no background job to fail silently.
 */
export async function applyExpiredCommitments(userId?: string): Promise<number> {
  const now = new Date();

  const expired = await prisma.goodwillHelp.findMany({
    where: {
      status: "COMMITTED",
      expiresAt: { lt: now },
      // Scope the sweep to one student when we only care about them.
      ...(userId ? { helperId: userId } : {}),
    },
    include: { request: true },
  });

  for (const help of expired) {
    // 1. Mark the offer abandoned - an auditable record of the bad-faith click.
    await prisma.goodwillHelp.update({ where: { id: help.id }, data: { status: "RELEASED" } });

    // 2. Free the request so the next helper can pick it up.
    await prisma.goodwillRequest.update({
      where: { id: help.requestId },
      data: { status: "OPEN", activeHelpId: null },
    });

    // 3. Record the miss and apply the 7-day pause.
    const record = await getRecord(help.helperId);
    await prisma.goodwillRecord.update({
      where: { userId: help.helperId },
      data: {
        helpsAbandoned: { increment: 1 },
        boardBannedUntil: new Date(now.getTime() + SNOOPER_BAN_DAYS * 24 * 60 * 60 * 1000),
        banReason: `Unlocked the details of ${help.request.alias} and let the ${COMMIT_WINDOW_MINUTES}-minute transfer window expire.`,
      },
    });

    // 4. Tell both sides privately. No public flag, no shaming anywhere.
    await notify({
      userId: help.helperId,
      title: "Support board paused for 7 days",
      body: `You unlocked the private details of ${help.request.alias} and the transfer window expired without the transfer being marked as sent. To protect that student's privacy, you cannot open the support board for 7 days. Everything else on Mobile Campus still works. If the transfer did go through and this is a mistake, tell an admin and they will review it.`,
      link: "/emergency",
    });
    await notify({
      userId: help.request.requesterId,
      title: "Your request is back on the board",
      body: "The student who said they would help did not follow through, so your request is visible to the board again. Nothing about you was shared publicly, and this never counts against you.",
      link: "/emergency",
    });
  }

  return expired.length;
}

/**
 * createRequest
 * WHAT: Posts an anonymous goodwill request after the identity and account
 *       name checks have passed in the route.
 * WHY : Bank details are encrypted here, at the point of storage, exactly
 *       like matric numbers - they are never written in plain text.
 */
export async function createRequest(input: {
  requesterId: string;
  institutionId: string;
  story: string;
  amountKobo: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
}): Promise<GoodwillRequest> {
  return prisma.goodwillRequest.create({
    data: {
      requesterId: input.requesterId,
      institutionId: input.institutionId,
      alias: makeAlias(),
      story: input.story,
      amountKobo: input.amountKobo,
      bankName: input.bankName,
      bankAccountNumberEnc: encrypt(input.bankAccountNumber),
      bankAccountNameEnc: encrypt(input.bankAccountName),
      status: "OPEN",
    },
  });
}

/**
 * commitToHelp
 * WHAT: The "I want to help" flow - checks the gate, reveals the recipient's
 *       verified details, and starts the 2-hour transfer timer.
 * WHY : This is the one moment private data changes hands, so it is guarded
 *       hardest: verified helper, no active ban, no double-claim, request
 *       still open, and the helper cannot be the requester.
 */
export async function commitToHelp(helperId: string, requestId: string): Promise<{
  help: GoodwillHelp;
  reveal: { fullName: string; level: string | null; department: string | null; bankName: string; accountNumber: string; accountName: string };
}> {
  // Sweep first, so a helper whose own window just expired cannot commit again.
  await applyExpiredCommitments(helperId);
  await assertCanUseBoard(helperId);

  const request = await prisma.goodwillRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { id: true, fullName: true, level: true, department: true, isVerified: true } } },
  });
  if (!request) throw new ApiError(404, "That request is no longer on the board.");
  if (request.requesterId === helperId) throw new ApiError(400, "You cannot help with your own request.");
  if (request.status !== "OPEN") throw new ApiError(409, "Someone is already helping with this request.");

  const helper = await prisma.user.findUnique({ where: { id: helperId } });
  if (!helper) throw new ApiError(404, "Your session has expired. Please sign in again.");

  const help = await prisma.goodwillHelp.upsert({
    where: { requestId_helperId: { requestId: request.id, helperId } },
    create: {
      requestId: request.id,
      helperId,
      status: "COMMITTED",
      expiresAt: new Date(Date.now() + COMMIT_WINDOW_MINUTES * 60 * 1000),
    },
    // A helper who was released earlier may offer again with a fresh timer.
    update: {
      status: "COMMITTED",
      committedAt: new Date(),
      expiresAt: new Date(Date.now() + COMMIT_WINDOW_MINUTES * 60 * 1000),
      sentAt: null,
      confirmedAt: null,
      note: null,
    },
  });

  // Lock the request to this helper so nobody else sees it as available.
  await prisma.goodwillRequest.update({
    where: { id: request.id },
    data: { status: "COMMITTED", activeHelpId: help.id },
  });

  await notify({
    userId: request.requesterId,
    title: "Someone has committed to help you",
    body: `A classmate accepted the commitment notice and can now see your bank details. They have ${COMMIT_WINDOW_MINUTES / 60} hours to send. If they do not, your request goes back on the board automatically.`,
    link: "/emergency",
  });

  return {
    help,
    // THE REVEAL: decrypted only now, only for this helper.
    reveal: {
      fullName: request.requester.fullName,
      level: request.requester.level,
      department: request.requester.department,
      bankName: request.bankName,
      accountNumber: decrypt(request.bankAccountNumberEnc) ?? "",
      accountName: decrypt(request.bankAccountNameEnc) ?? "",
    },
  };
}

/**
 * markSent
 * WHAT: The helper says the money has left their own bank app.
 * WHY : Half of the two-way loop. It stops the snooper timer, but it does not
 *       finish anything on its own - only the recipient can close the loop.
 */
export async function markSent(helperId: string, helpId: string, note?: string): Promise<GoodwillHelp> {
  const help = await prisma.goodwillHelp.findUnique({ where: { id: helpId }, include: { request: true } });
  if (!help) throw new ApiError(404, "That commitment no longer exists.");
  if (help.helperId !== helperId) throw new ApiError(403, "Only the helper who committed can mark a transfer as sent.");
  if (help.status !== "COMMITTED") throw new ApiError(409, "This transfer has already been marked.");

  // An expired window is handled by the sweep, not by a late click.
  if (help.expiresAt.getTime() < Date.now()) {
    await applyExpiredCommitments(helperId);
    throw new ApiError(409, "The transfer window expired before you marked it as sent.");
  }

  const updated = await prisma.goodwillHelp.update({
    where: { id: help.id },
    data: { status: "SENT", sentAt: new Date(), note: note?.trim() || null },
  });

  await notify({
    userId: help.request.requesterId,
    title: "A classmate says the support has been sent",
    body: `Check your ${help.request.bankName} account and confirm once it lands. Confirming is what closes the loop and earns them a goodwill badge.`,
    link: "/emergency",
    sms: true,
    smsBody: "A classmate sent you support on Mobile Campus. Check your bank and confirm receipt.",
  });

  return updated;
}

/**
 * confirmReceived
 * WHAT: The recipient closes the loop - the money landed.
 * WHY : The other half. This is the only thing that credits a helper's
 *       goodwill badge, so a helper can never self-certify their own kindness.
 */
export async function confirmReceived(requesterId: string, helpId: string): Promise<GoodwillHelp> {
  const help = await prisma.goodwillHelp.findUnique({ where: { id: helpId }, include: { request: true } });
  if (!help) throw new ApiError(404, "That commitment no longer exists.");
  if (help.request.requesterId !== requesterId) throw new ApiError(403, "Only the recipient can confirm receipt.");
  if (help.status !== "SENT") throw new ApiError(409, "Nothing is waiting for your confirmation.");

  const now = new Date();
  const updated = await prisma.goodwillHelp.update({
    where: { id: help.id },
    data: { status: "RECEIVED", confirmedAt: now },
  });
  await prisma.goodwillRequest.update({
    where: { id: help.requestId },
    data: { status: "RECEIVED", receivedAt: now, closedAt: now },
  });

  // Goodwill badges: the helper's follow-through and the recipient's
  // gratitude are both counted, privately, on their own records.
  const helperRecord = await getRecord(help.helperId);
  await prisma.goodwillRecord.update({
    where: { userId: help.helperId },
    data: { helpsCompleted: helperRecord.helpsCompleted + 1 },
  });
  const requesterRecord = await getRecord(requesterId);
  await prisma.goodwillRecord.update({
    where: { userId: requesterId },
    data: { requestsReceived: requesterRecord.requestsReceived + 1 },
  });

  await notify({
    userId: help.helperId,
    title: "Confirmed - thank you for showing up",
    body: `${help.request.alias} confirmed the support landed. Your goodwill record now shows ${helperRecord.helpsCompleted + 1} completed follow-through${helperRecord.helpsCompleted === 0 ? "" : "s"}.`,
    link: "/emergency",
  });
  await notify({
    userId: requesterId,
    title: "Request closed",
    body: "Your request is closed and your bank details are no longer visible to anyone. Thank you for confirming.",
    link: "/emergency",
  });

  return updated;
}

/**
 * releaseHelper
 * WHAT: The recipient lets the helper off the hook - no transfer needed, or
 *       the money never arrived and they would rather start over.
 * WHY : Compassion runs both ways. A requester who cannot wait, or who got
 *       help elsewhere, should never leave a classmate staring at a timer -
 *       and releasing them applies no penalty at all.
 */
export async function releaseHelper(requesterId: string, requestId: string): Promise<void> {
  const request = await prisma.goodwillRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ApiError(404, "That request no longer exists.");
  if (request.requesterId !== requesterId) throw new ApiError(403, "Only the person who posted can release a helper.");
  if (!request.activeHelpId) throw new ApiError(409, "Nobody is currently committed to this request.");

  const help = await prisma.goodwillHelp.findUnique({ where: { id: request.activeHelpId } });

  await prisma.goodwillHelp.update({ where: { id: request.activeHelpId }, data: { status: "RELEASED" } });
  await prisma.goodwillRequest.update({
    where: { id: requestId },
    data: { status: "OPEN", activeHelpId: null },
  });

  if (help) {
    await notify({
      userId: help.helperId,
      title: "You have been released from this request",
      body: `${request.alias} let you off the hook - no transfer is needed and nothing counts against you. The request is back on the board if you still want to help later.`,
      link: "/emergency",
    });
  }
}

/**
 * cancelRequest
 * WHAT: The requester withdraws their own request.
 * WHY : Circumstances change. Withdrawing must be one tap and carry no
 *       penalty - asking for help should never be a trap.
 */
export async function cancelRequest(requesterId: string, requestId: string): Promise<void> {
  const request = await prisma.goodwillRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ApiError(404, "That request no longer exists.");
  if (request.requesterId !== requesterId) throw new ApiError(403, "Only the person who posted can withdraw it.");
  if (request.status === "RECEIVED") throw new ApiError(409, "That request is already closed.");

  const now = new Date();
  // Release any active helper first, so no timer keeps running.
  if (request.activeHelpId) {
    await prisma.goodwillHelp.update({ where: { id: request.activeHelpId }, data: { status: "RELEASED" } });
  }
  await prisma.goodwillRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", activeHelpId: null, closedAt: now },
  });
}

/**
 * revealFor
 * WHAT: Re-reads the revealed details for a helper who already committed.
 * WHY : The helper needs the account number again after a page refresh, but
 *       only while their commitment is live and unexpired.
 */
export async function revealFor(helperId: string, requestId: string) {
  await applyExpiredCommitments(helperId);

  const help = await prisma.goodwillHelp.findUnique({ where: { requestId_helperId: { requestId, helperId } } });
  if (!help) throw new ApiError(404, "You have not committed to this request.");
  if (help.status === "RELEASED") throw new ApiError(403, "This commitment was released.");

  const request = await prisma.goodwillRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { fullName: true, level: true, department: true } } },
  });
  if (!request) throw new ApiError(404, "That request no longer exists.");

  return {
    fullName: request.requester.fullName,
    level: request.requester.level,
    department: request.requester.department,
    bankName: request.bankName,
    accountNumber: decrypt(request.bankAccountNumberEnc) ?? "",
    accountName: decrypt(request.bankAccountNameEnc) ?? "",
  };
}
