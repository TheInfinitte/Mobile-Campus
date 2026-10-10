/**
 * src/lib/api.ts
 * WHAT: A tiny helper for writing JSON responses from API routes.
 * WHY : Every route needs the same shape of response. Doing it in one place
 *       means the client can always trust `{ data }` or `{ error }`.
 */
import { NextResponse } from "next/server";
import { ApiError } from "./auth";

/**
 * json
 * WHAT: Returns a JSON response with the given status code.
 * WHY : Shorter and consistent in every route.
 */
export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/**
 * fail
 * WHAT: Returns an error response: { error: "message" }.
 * WHY : The client shows this message directly to the user, so it must be
 *       written in plain English, never a stack trace.
 */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * handleError
 * WHAT: Converts any thrown error into a safe JSON response.
 * WHY : Unknown errors must never leak server details to the browser. We log
 *       the real error server-side and send a generic message to the user.
 */
export function handleError(error: unknown): NextResponse {
  // Our own errors carry a status code and a message meant for the user.
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }

  // Prisma unique-constraint violations are common and worth a friendly message.
  if (isPrismaUniqueError(error)) {
    return fail("That record already exists.", 409);
  }

  console.error("[api] Unexpected error:", error);
  return fail("Something went wrong on our side. Please try again.", 500);
}

/**
 * isPrismaUniqueError
 * WHAT: Detects Prisma's P2002 "unique constraint failed" error.
 * WHY : It usually means "this phone number is already registered", which we
 *       want to explain nicely rather than as a 500.
 */
function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * readJson
 * WHAT: Safely reads and parses a request body.
 * WHY : A malformed body should give a 400 with a clear message, not a crash.
 */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "We could not read that request. Please try again.");
  }
}
