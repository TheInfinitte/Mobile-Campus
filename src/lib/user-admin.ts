/**
 * src/lib/user-admin.ts
 * WHAT: The rules for staff acting on other accounts - suspending, lifting a
 *       suspension, changing a role, and saving a private note.
 * WHY : These are the most dangerous actions in the whole app. A mistake here
 *       locks a student out or hands admin powers to the wrong person, so the
 *       rules are written down in one file and the API route just calls them.
 *
 * WHO MAY DO WHAT
 *   - Only SUPER_ADMIN reaches any of this. The API route enforces that with
 *     requireSuperAdmin(), and this file repeats the important guard because
 *     a bug in one place should not be enough to cause damage.
 *   - Nobody may change their OWN role. Locking yourself out of the only
 *     SUPER_ADMIN account is unrecoverable without database access.
 *   - An ADMIN account can only be suspended by a SUPER_ADMIN, and never
 *     silently: the reason is stored and shown in the audit list.
 */
import { prisma } from "./prisma";
import { ApiError } from "./auth";
import { notify } from "./notifications";
import type { UserRole } from "@prisma/client";

/** The actions a platform owner can take on an account. */
export type UserAction = "SUSPEND" | "LIFT" | "SET_ROLE" | "NOTE";

/** What the account looks like in the admin list. */
export interface AdminUserRow {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: UserRole;
  isVerified: boolean;
  verificationStatus: string;
  institution: string;
  bannedUntil: Date | null;
  banReason: string | null;
  bannedBy: string | null;
  adminNote: string | null;
  createdAt: Date;
}

/**
 * searchUsers
 * WHAT: Finds accounts by name, phone or email, newest first.
 * WHY : Support always starts from a phone number or a name typed into a
 *       ticket. A prefix search on phone plus a contains search on name covers
 *       both without exposing the whole user table.
 *
 * @param query   text to match - ignored when empty
 * @param role    optional role filter, e.g. only students
 */
export async function searchUsers(query: string, role?: UserRole, limit = 50): Promise<AdminUserRow[]> {
  const trimmed = query.trim();

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(trimmed
        ? {
            OR: [
              { fullName: { contains: trimmed, mode: "insensitive" } },
              { phone: { contains: trimmed } },
              ...(trimmed.includes("@") ? [{ email: { contains: trimmed, mode: "insensitive" as const } }] : []),
            ],
          }
        : {}),
    },
    include: {
      institution: { select: { shortName: true } },
      bannedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role,
    isVerified: u.isVerified,
    verificationStatus: u.verificationStatus,
    institution: u.institution.shortName,
    bannedUntil: u.bannedUntil,
    banReason: u.banReason,
    bannedBy: u.bannedBy?.fullName ?? null,
    adminNote: u.adminNote,
    createdAt: u.createdAt,
  }));
}

/** Result returned to the admin UI after an action. */
export interface UserActionResult {
  userId: string;
  action: UserAction;
  message: string;
}

/**
 * applyUserAction
 * WHAT: Runs one privileged action on one account.
 * WHY : Single entry point, so the "cannot act on yourself" rule and the
 *       audit fields are impossible to skip.
 *
 * @param actorId the SUPER_ADMIN performing the action
 */
export async function applyUserAction(input: {
  actorId: string;
  userId: string;
  action: UserAction;
  days?: number;
  reason?: string;
  role?: UserRole;
  adminNote?: string;
}): Promise<UserActionResult> {
  const { actorId, userId, action, days, reason, role, adminNote } = input;

  // --- Guard 1: never act on your own account ----------------------------
  // Changing your own role can lock the last platform owner out. Changing
  // your own suspension makes no sense. Refuse outright.
  if (actorId === userId) {
    throw new ApiError(400, "You cannot do that to your own account.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, role: true, phone: true },
  });
  if (!target) throw new ApiError(404, "That account no longer exists.");

  // --- SUSPEND -----------------------------------------------------------
  if (action === "SUSPEND") {
    if (!reason) throw new ApiError(400, "Give a reason. The user will see it, and so will the next admin.");

    // days = 0 (or omitted) means permanent: we store the maximum date JS can
    // represent, so the single rule "bannedUntil > now means banned" is true
    // for both timed and permanent suspensions and no caller needs a special
    // case. A timed ban stores its real release date instead.
    const isPermanent = !days || days <= 0;
    const bannedUntil = isPermanent
      ? new Date(8_640_000_000_000_000) // year 275760 - JS max date
      : new Date(Date.now() + days * 86_400_000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        bannedUntil,
        banReason: reason,
        bannedById: actorId,
      },
    });

    // Tell them. This is in-app only - an SMS would cost money for a message
    // the user will also see the next time they open the app.
    await notify({
      userId,
      title: "Your account has been suspended",
      body: `Reason: ${reason}. ${
        isPermanent
          ? "This suspension has no end date. Contact support if you believe this is a mistake."
          : `You can sign in again on ${bannedUntil.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.`
      }`,
    });

    return {
      userId,
      action,
      message: isPermanent
        ? `${target.fullName} is suspended indefinitely.`
        : `${target.fullName} is suspended for ${days} day${days === 1 ? "" : "s"}.`,
    };
  }

  // --- LIFT --------------------------------------------------------------
  if (action === "LIFT") {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        bannedUntil: null,
        banReason: null,
        bannedById: null,
      },
      select: { fullName: true },
    });

    await notify({
      userId,
      title: "Your account is active again",
      body: "A moderator lifted the suspension on your account. You can sign in as normal.",
    });

    return { userId, action, message: `${updated.fullName} can sign in again.` };
  }

  // --- SET_ROLE ----------------------------------------------------------
  if (action === "SET_ROLE") {
    if (!role) throw new ApiError(400, "Pick the role to assign.");
    if (role === target.role) throw new ApiError(400, `${target.fullName} already has that role.`);

    // Never demote the last platform owner. If this account is the only
    // SUPER_ADMIN left, removing that role would leave the platform with
    // nobody who can manage users - and no way back without database access.
    if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      const owners = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
      if (owners <= 1) {
        throw new ApiError(400, "That is the only platform owner account. Promote someone else first.");
      }
    }

    await prisma.user.update({ where: { id: userId }, data: { role } });

    // Tell the person, but only when it is a promotion to staff - being told
    // "you are now an admin" is useful, and demotions are handled in person.
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      await notify({
        userId,
        title: role === "SUPER_ADMIN" ? "You are now a platform owner" : "You are now an administrator",
        body: "You can open the admin area from the app menu. Please read the moderation guidelines before acting on student content.",
        link: "/admin",
      });
    }

    return { userId, action, message: `${target.fullName} is now ${role === "SUPER_ADMIN" ? "a platform owner" : role.toLowerCase()}.` };
  }

  // --- NOTE --------------------------------------------------------------
  // Private note. No status change, no notification - the user never sees it.
  if (adminNote === undefined) throw new ApiError(400, "Write the note you want to save.");

  await prisma.user.update({ where: { id: userId }, data: { adminNote: adminNote || null } });

  return { userId, action, message: adminNote ? "Note saved." : "Note cleared." };
}
