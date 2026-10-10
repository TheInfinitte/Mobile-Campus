/**
 * src/app/api/profile/skills/route.ts
 * WHAT: Saves the skills a student offers, used by the Project Hub matcher.
 * WHY : Skill tags power "projects for you": a project needing a Designer finds
 *       students who tagged Designer.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, skillsSchema } from "@/lib/validators";

/**
 * PATCH /api/profile/skills
 * Body: { skills: ["Developer", "Designer"] }
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = safeParse(skillsSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    await prisma.user.update({ where: { id: user.id }, data: { skills: parsed.data.skills } });
    return json({ skills: parsed.data.skills });
  } catch (error) {
    return handleError(error);
  }
}
