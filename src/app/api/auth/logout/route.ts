/**
 * src/app/api/auth/logout/route.ts
 * WHAT: Deletes the session cookie (signs the user out).
 * WHY : Students share phones and use campus computers. A one-tap, guaranteed
 *       sign-out is a basic safety requirement.
 *
 * It accepts POST (for the form in the desktop nav) and GET (for convenience
 * links), and always redirects back to the home page afterwards.
 */
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { env } from "@/lib/env";

/** Signs out and returns a JSON confirmation (for fetch calls). */
export async function POST(): Promise<NextResponse> {
  destroySession();
  return NextResponse.json({ data: { signedOut: true } });
}

/** Signs out and redirects to the home page (for plain form submissions). */
export async function GET(request: Request): Promise<NextResponse> {
  destroySession();
  return NextResponse.redirect(new URL("/", env.app.url), 303);
}
