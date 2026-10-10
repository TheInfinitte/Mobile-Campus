/**
 * src/app/api/projects/[id]/applications/route.ts
 * WHAT: Applying to join a project (student side) and reviewing applicants
 *       (owner side). Approval unlocks the full pitch for that applicant.
 * WHY : The owner gates access personally - that is what makes the blind pitch
 *       safe. Skill tags travel with the application so the owner can see the
 *       complementary fit at a glance.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { readJson, fail, json, handleError } from "@/lib/api";
import { safeParse, projectApplicationSchema } from "@/lib/validators";
import { notify } from "@/lib/notifications";

type RouteContext = { params: { id: string } };

/**
 * GET - owner only: the applicant list with skills offered.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const project = await prisma.project.findUnique({ where: { id: context.params.id } });
    if (!project) return fail("That project was not found.", 404);
    if (project.ownerId !== user.id && user.role !== "ADMIN") {
      return fail("Only the project owner can see applicants.", 403);
    }

    const applications = await prisma.projectApplication.findMany({
      where: { projectId: project.id },
      include: {
        applicant: {
          select: { id: true, fullName: true, avatarUrl: true, level: true, department: true, skills: true },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    return json({ applications });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST - a student applies with a message and the skills they offer.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") return fail("Only student accounts can apply to projects.", 403);

    const project = await prisma.project.findUnique({ where: { id: context.params.id } });
    if (!project || project.status !== "OPEN") return fail("This project is not accepting applicants.", 404);
    if (project.ownerId === user.id) return fail("You cannot apply to your own project.", 400);

    // Same-school projects only accept students of that school.
    if (project.scope === "SAME_SCHOOL" && project.institutionId !== user.institutionId) {
      return fail("This project needs people on its own campus.", 403);
    }

    const body = await readJson(request);
    const parsed = safeParse(projectApplicationSchema, body);
    if (!parsed.ok) return fail(parsed.error, 400);

    const existing = await prisma.projectApplication.findUnique({
      where: { projectId_applicantId: { projectId: project.id, applicantId: user.id } },
    });
    if (existing) return fail("You have already applied to this project.", 409);

    const application = await prisma.projectApplication.create({
      data: {
        projectId: project.id,
        applicantId: user.id,
        message: parsed.data.message,
        skillsOffered: parsed.data.skillsOffered,
      },
    });

    await notify({
      userId: project.ownerId,
      title: "New project applicant",
      body: `${user.fullName} wants to join "${project.title}" offering ${parsed.data.skillsOffered.join(", ")}.`,
      link: `/projects/${project.id}`,
    });

    return json({ id: application.id }, 201);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH - owner decides on one applicant.
 * Body: { applicationId, decision: "APPROVED" | "DECLINED" }
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const project = await prisma.project.findUnique({ where: { id: context.params.id } });
    if (!project) return fail("That project was not found.", 404);
    if (project.ownerId !== user.id) return fail("Only the project owner can decide on applicants.", 403);

    const body = (await readJson(request)) as { applicationId?: string; decision?: string };
    const decision = body.decision === "APPROVED" ? "APPROVED" : body.decision === "DECLINED" ? "DECLINED" : null;
    if (!body.applicationId || !decision) return fail("Provide the application and a decision.", 400);

    const application = await prisma.projectApplication.findUnique({ where: { id: body.applicationId } });
    if (!application || application.projectId !== project.id) {
      return fail("That application does not belong to this project.", 404);
    }

    await prisma.projectApplication.update({
      where: { id: application.id },
      data: { status: decision, decidedAt: new Date() },
    });

    await notify({
      userId: application.applicantId,
      title: decision === "APPROVED" ? "You are in! 🎉" : "Application update",
      body:
        decision === "APPROVED"
          ? `You joined "${project.title}". The full pitch is now unlocked for you.`
          : `The owner of "${project.title}" went with other applicants this time.`,
      link: `/projects/${project.id}`,
    });

    return json({ id: application.id, status: decision });
  } catch (error) {
    return handleError(error);
  }
}
