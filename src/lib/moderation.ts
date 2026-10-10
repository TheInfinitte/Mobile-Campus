/**
 * src/lib/moderation.ts
 * WHAT: The business rules for admin content moderation - flagging, hiding,
 *       restoring and deleting market items, gigs and lodges.
 * WHY : Three different content types need the same four actions, and each
 *       action has consequences (notifying the owner, recording who acted,
 *       refusing impossible transitions). Putting the rules here means the
 *       API route stays thin and a rule change happens in one file.
 *
 * THE FOUR ACTIONS
 *   FLAG    - Mark for review. The content stays visible while an admin
 *             decides. Not a punishment, so the owner is not told.
 *   HIDE    - Pull it off the student board immediately. The owner IS told,
 *             with the reason, because they may be able to fix it.
 *   RESTORE - Put it back on the board. Clears the note and the flag.
 *   DELETE  - Remove it permanently. The owner is told. Use for counterfeit
 *             or prohibited items where restoring would be wrong.
 *
 * IMPORTANT: a HIDDEN or FLAGGED item is excluded from the student-facing
 * board because those queries filter on status (AVAILABLE / OPEN). That
 * filter is what makes hiding work - see src/app/api/market/route.ts.
 */
import { prisma } from "./prisma";
import { ApiError } from "./auth";
import { notify } from "./notifications";

/** The kinds of content an admin can moderate. */
export type ModerationTarget = "MARKET_ITEM" | "GIG" | "LODGE";

/** What the admin wants to do to it. */
export type ModerationAction = "FLAG" | "HIDE" | "RESTORE" | "DELETE";

/**
 * TARGET_LABELS
 * WHAT: Human-readable names, used in the owner's notification.
 * WHY : "Your listing was hidden" is vague. "Your market item was hidden"
 *       tells the student exactly what to look for.
 */
export const TARGET_LABELS: Record<ModerationTarget, string> = {
  MARKET_ITEM: "market item",
  GIG: "gig post",
  LODGE: "room listing",
};

/**
 * STATUS_FOR_ACTION
 * WHAT: Which status each action sets, per content type.
 * WHY : Each model has its own status enum, and the "normal" value differs
 *       (a market item goes back to AVAILABLE, a gig to OPEN, a lodge to
 *       ACTIVE). Spelling that out here prevents a restore that accidentally
 *       marks a gig as COMPLETED.
 */
const STATUS_FOR_ACTION: Record<ModerationTarget, Partial<Record<ModerationAction, string>>> = {
  MARKET_ITEM: { FLAG: "FLAGGED", HIDE: "HIDDEN", RESTORE: "AVAILABLE" },
  GIG: { FLAG: "FLAGGED", HIDE: "HIDDEN", RESTORE: "OPEN" },
  LODGE: { FLAG: "UNDER_REVIEW", HIDE: "REMOVED", RESTORE: "ACTIVE" },
};

/** Result of a moderation action, returned to the admin UI. */
export interface ModerationResult {
  type: ModerationTarget;
  id: string;
  title: string;
  status: string;
  action: ModerationAction;
}

/**
 * loadTarget
 * WHAT: Fetches the content row plus the owner's userId, or throws 404.
 * WHY : Every action needs the current status (to reject nonsense) and the
 *       owner (to notify). One loader keeps that consistent across three
 *       different tables.
 */
async function loadTarget(type: ModerationTarget, id: string): Promise<{ title: string; ownerId: string; status: string }> {
  if (type === "MARKET_ITEM") {
    const item = await prisma.marketItem.findUnique({
      where: { id },
      select: { title: true, sellerId: true, status: true },
    });
    if (!item) throw new ApiError(404, "That market item no longer exists.");
    return { title: item.title, ownerId: item.sellerId, status: item.status };
  }

  if (type === "GIG") {
    const gig = await prisma.gig.findUnique({
      where: { id },
      select: { title: true, posterId: true, status: true },
    });
    if (!gig) throw new ApiError(404, "That gig post no longer exists.");
    return { title: gig.title, ownerId: gig.posterId, status: gig.status };
  }

  const lodge = await prisma.lodge.findUnique({
    where: { id },
    select: { title: true, landlordId: true, status: true },
  });
  if (!lodge) throw new ApiError(404, "That room listing no longer exists.");
  return { title: lodge.title, ownerId: lodge.landlordId, status: lodge.status };
}

/**
 * moderate
 * WHAT: Applies one moderation action to one piece of content and notifies
 *       the owner when the action affects them.
 * WHY : Single entry point for all moderation, so the audit trail
 *       (moderatedById + moderationNote) is always written and the owner is
 *       never left wondering what happened.
 *
 * @param adminId  the staff member acting - recorded for the audit trail
 */
export async function moderate(input: {
  type: ModerationTarget;
  id: string;
  action: ModerationAction;
  note?: string;
  adminId: string;
}): Promise<ModerationResult> {
  const { type, id, action, note, adminId } = input;
  const target = await loadTarget(type, id);

  // FLAG and HIDE change what students see, so they need a reason. Without
  // one, the owner gets an unexplained removal and support gets an angry
  // message. RESTORE and DELETE do not require one.
  if ((action === "FLAG" || action === "HIDE") && !note) {
    throw new ApiError(400, action === "HIDE" ? "Say why you are hiding this, so the owner can fix it." : "Add a short note explaining the flag.");
  }

  // DELETE has no status transition - the row goes away.
  const nextStatus = STATUS_FOR_ACTION[type][action];
  if (action !== "DELETE" && !nextStatus) {
    throw new ApiError(400, `That action is not available for a ${TARGET_LABELS[type]}.`);
  }

  // --- Apply the change --------------------------------------------------
  // Each table is updated separately because their fields differ slightly
  // (a lodge has no moderatedBy relation in the schema).
  if (type === "MARKET_ITEM") {
    if (action === "DELETE") {
      await prisma.marketItem.delete({ where: { id } });
    } else {
      await prisma.marketItem.update({
        where: { id },
        data: {
          status: nextStatus as "AVAILABLE",
          // Clearing the note on restore keeps the record honest: no note
          // means "not currently under moderation".
          moderationNote: action === "RESTORE" ? null : note,
          flaggedAt: action === "FLAG" ? new Date() : action === "RESTORE" ? null : undefined,
          moderatedById: adminId,
        },
      });
    }
  } else if (type === "GIG") {
    if (action === "DELETE") {
      await prisma.gig.delete({ where: { id } });
    } else {
      await prisma.gig.update({
        where: { id },
        data: {
          status: nextStatus as "OPEN",
          moderationNote: action === "RESTORE" ? null : note,
          flaggedAt: action === "FLAG" ? new Date() : action === "RESTORE" ? null : undefined,
          moderatedById: adminId,
        },
      });
    }
  } else {
    if (action === "DELETE") {
      await prisma.lodge.delete({ where: { id } });
    } else {
      await prisma.lodge.update({
        where: { id },
        data: { status: nextStatus as "ACTIVE" },
      });
    }
  }

  // --- Tell the owner ----------------------------------------------------
  // Only HIDE and DELETE are told to the owner. FLAG is an internal review
  // step - telling someone "you are under review" invites arguments about
  // content that may well be fine.
  if (action === "HIDE" || action === "DELETE") {
    const label = TARGET_LABELS[type];
    const verb = action === "HIDE" ? "taken off the board" : "removed";
    await notify({
      userId: target.ownerId,
      title: `Your ${label} was ${verb}`,
      body: note
        ? `"${target.title}" was ${verb} by a moderator. Reason: ${note}`
        : `"${target.title}" was ${verb} by a moderator.`,
      // Link to the board the content belongs to, so the owner can see what
      // is still live. There is no "my listings" page for students, so the
      // board itself is the useful destination.
      link: type === "LODGE" ? "/landlord" : type === "GIG" ? "/gigs" : "/market",
    });
  }

  return {
    type,
    id,
    title: target.title,
    status: action === "DELETE" ? "DELETED" : (nextStatus as string),
    action,
  };
}

/**
 * moderationQueue
 * WHAT: Returns content needing an admin's attention across all three types,
 *       newest report first.
 * WHY : One queue beats three tabs. An admin opens the moderation page and
 *       sees everything waiting, whichever board it came from.
 *
 * @param limit how many rows per content type to include
 */
export async function moderationQueue(limit = 50) {
  // Content an admin has already acted on, plus anything currently reported.
  // Reported-but-unreviewed content matters most, so it is fetched too.
  const [items, gigs, lodges, openReports] = await Promise.all([
    prisma.marketItem.findMany({
      where: { status: { in: ["FLAGGED", "HIDDEN"] } },
      include: { seller: { select: { id: true, fullName: true, phone: true } }, reports: { where: { status: "OPEN" }, select: { id: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.gig.findMany({
      where: { status: { in: ["FLAGGED", "HIDDEN"] } },
      include: { poster: { select: { id: true, fullName: true, phone: true } }, reports: { where: { status: "OPEN" }, select: { id: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.lodge.findMany({
      where: { status: { in: ["UNDER_REVIEW", "REMOVED"] } },
      include: { landlord: { select: { id: true, fullName: true, phone: true } }, reports: { where: { status: "OPEN" }, select: { id: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);

  // Normalise the three shapes into one list so the UI renders one table.
  const rows = [
    ...items.map((i) => ({
      type: "MARKET_ITEM" as ModerationTarget,
      id: i.id,
      title: i.title,
      status: i.status,
      owner: i.seller,
      openReports: i.reports.length,
      updatedAt: i.updatedAt,
    })),
    ...gigs.map((g) => ({
      type: "GIG" as ModerationTarget,
      id: g.id,
      title: g.title,
      status: g.status,
      owner: g.poster,
      openReports: g.reports.length,
      updatedAt: g.updatedAt,
    })),
    ...lodges.map((l) => ({
      type: "LODGE" as ModerationTarget,
      id: l.id,
      title: l.title,
      status: l.status,
      owner: l.landlord,
      openReports: l.reports.length,
      updatedAt: l.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return { rows, openReports };
}
