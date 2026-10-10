/**
 * src/app/api/projects/[id]/route.ts
 * WHAT: One project. The teaser is public; the FULL PITCH (fullDetails +
 *       contactNote) is released ONLY to the owner, admins, or applicants the
 *       owner approved.
 * WHY : Blind pitch protects intellectual property: strangers see the problem
 *       and the skills needed, never the plan.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { fail, json, handleError } from "@/lib/api";

type RouteContext = { params: { id: string } };

/**
 * GET /api/projects/:id
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const viewer = await getSessionUser();
    if (viewer?.role === "LANDLORD") return fail("The project hub is a student space.", 403);

    const project = await prisma.project.findUnique({
      where: { id: context.params.id },
      include: {
        owner: { select: { id: true, fullName: true, avatarUrl: true, level: true, department: true } },
        institution: { select: { shortName: true, name: true } },
        applications: {
          // Only the viewer's own application is fetched here.
          where: { applicantId: viewer?.id ?? "" },
          select: { id: true, status: true, message: true, skillsOffered: true, createdAt: true },
          take: 1,
        },
      },
    });
    if (!project) return fail("That project was not found.", 404);

    // Visibility: national projects are open to all schools; same-school
    // projects only to students of that school (owner/admin always).
    const isOwner = viewer?.id === project.ownerId;
    const isAdmin = viewer?.role === "ADMIN";
    if (
      project.scope === "SAME_SCHOOL" &&
      !isOwner &&
      !isAdmin &&
      (!viewer || viewer.institutionId !== project.institutionId)
    ) {
      return fail("This project is only open to students of its own institution.", 403);
    }

    const myApplication = project.applications[0] ?? null;
    // THE UNLOCK RULE: full details only after explicit approval.
    const unlocked = Boolean(isOwner || isAdmin || myApplication?.status === "APPROVED");

    return json({
      project: {
        id: project.id,
        title: project.title,
        problem: project.problem,
        domain: project.domain,
        stage: project.stage,
        skillsNeeded: project.skillsNeeded,
        scope: project.scope,
        status: project.status,
        institution: project.institution,
        owner: project.owner,
        createdAt: project.createdAt,
        isOwner,
        unlocked,
        myApplication,
        // Private fields appear ONLY when unlocked.
        fullDetails: unlocked ? project.fullDetails : null,
        contactNote: unlocked ? project.contactNote : null,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
