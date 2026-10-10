/**
 * src/app/api/admin/users/route.ts
 * WHAT: Platform-owner-only account management.
 *       GET   - search accounts by name, phone or email.
 *       PATCH - suspend, lift a suspension, change a role, or save a note.
 * WHY : This is the most sensitive endpoint in the app: it can lock a student
 *       out or grant admin powers. Every request is checked with
 *       requireSuperAdmin(), which throws 403 for an ordinary ADMIN. Ordinary
 *       staff can review verifications and disputes, but they cannot ban
 *       people or hand out roles - that stays with the platform owners.
 */
import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { json, fail, handleError, readJson } from "@/lib/api";
import { safeParse, userActionSchema } from "@/lib/validators";
import { applyUserAction, searchUsers } from "@/lib/user-admin";
import type { UserRole } from "@prisma/client";

/** Roles a caller may filter by. */
const ROLE_FILTERS: UserRole[] = ["STUDENT", "LANDLORD", "ADMIN", "SUPER_ADMIN"];

/**
 * GET /api/admin/users?q=0803&role=STUDENT
 * WHAT: Returns matching accounts with their suspension state and role.
 * WHY : Support work starts here - find the account, then act on it.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSuperAdmin();

    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const roleParam = url.searchParams.get("role");

    // Only accept a role we know about; ignore anything else rather than
    // passing a raw string into a Prisma enum comparison.
    const role = ROLE_FILTERS.includes(roleParam as UserRole) ? (roleParam as UserRole) : undefined;

    const users = await searchUsers(query, role);

    return json({ users });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/admin/users
 * WHAT: Applies one privileged action to one account.
 * Body: { userId, action, days?, reason?, role?, adminNote? }
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const actor = await requireSuperAdmin();

    const body = await readJson(request);
    const parsed = safeParse(userActionSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const { userId, action, days, reason, role, adminNote } = parsed.data;

    const result = await applyUserAction({
      actorId: actor.id,
      userId,
      action,
      days,
      reason,
      role,
      adminNote,
    });

    return json(result);
  } catch (error) {
    return handleError(error);
  }
}
