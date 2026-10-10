/**
 * src/app/api/projects/route.ts
 * WHAT: The collaboration hub list + creating a blind-pitch project.
 * WHY : Students find co-founders without exposing their idea: the public list
 *       carries ONLY the teaser (problem, domain, stage, skills, scope). The
 *       full pitch is released per-user after the owner approves them.
 *
 * VISIBILITY RULES:
 *   - scope = NATIONAL: visible to students of EVERY institution.
 *   - scope = SAME_SCHOOL: visible only inside the owner's institution.
 *   - ?tab=forYou: only projects whose skillsNeeded overlap the viewer's
 *     saved skills (skill-based matching).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, projectSchema } from "@/lib/validators";
import { getViewerInstitution } from "@/lib/institution";

/**
 * GET /api/projects?tab=forYou
 * Public teaser list for the viewer's campus (plus national projects).
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const forYou = url.searchParams.get("tab") === "forYou";
    const viewer = await getSessionUser();
    if (viewer?.role === "LANDLORD") return fail("The project hub is a student space.", 403);

    const institution = await getViewerInstitution();

    const rows = await prisma.project.findMany({
      where: {
        status: "OPEN",
        // Silo with a national escape hatch for digital projects.
        OR: [{ institutionId: institution.id }, { scope: "NATIONAL" }],
      },
      include: {
        owner: { select: { id: true, fullName: true, avatarUrl: true, level: true, department: true } },
        institution: { select: { shortName: true } },
        _count: { select: { applications: true } },
        // The viewer's own application (if any) - an empty id matches nothing.
        applications: {
          where: { applicantId: viewer?.id ?? "" },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    let projects = rows.map((project) => ({
      id: project.id,
      title: project.title,
      // BLIND PITCH: teaser fields only. fullDetails is never in this query.
      problem: project.problem,
      domain: project.domain,
      stage: project.stage,
      skillsNeeded: project.skillsNeeded,
      scope: project.scope,
      institution: project.institution.shortName,
      applicationCount: project._count.applications,
      owner: project.owner,
      myApplicationStatus: project.applications?.[0]?.status ?? null,
      createdAt: project.createdAt,
    }));

    // Skill-based matching: keep projects that need at least one skill the
    // viewer offers.
    if (forYou && viewer && viewer.skills.length > 0) {
      const mine = new Set(viewer.skills.map((skill) => skill.toLowerCase()));
      projects = projects.filter((project) =>
        project.skillsNeeded.some((skill) => mine.has(skill.toLowerCase()))
      );
    }

    return json({ projects });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/projects
 * Students create a blind pitch. The private fields are stored but never
 * listed publicly.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only student accounts can create projects.", 403);

    const body = await readJson(request);
    const parsed = safeParse(projectSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const project = await prisma.project.create({
      data: {
        ownerId: user.id,
        institutionId: user.institutionId,
        title: parsed.data.title,
        problem: parsed.data.problem,
        domain: parsed.data.domain,
        stage: parsed.data.stage,
        skillsNeeded: parsed.data.skillsNeeded,
        scope: parsed.data.scope,
        fullDetails: parsed.data.fullDetails,
        contactNote: parsed.data.contactNote ?? null,
      },
    });

    return json({ id: project.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
