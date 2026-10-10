/**
 * src/middleware.ts
 * WHAT: The first thing that runs on every /admin page request. It checks the
 *       login cookie and bounces anyone who is not allowed to be here.
 * WHY : Without it, an unauthenticated visitor waits for a whole admin page to
 *       render before being redirected. This rejects them immediately.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANT - WHAT THIS FILE CAN AND CANNOT DO
 * ---------------------------------------------------------------------------
 * Next.js runs middleware in the EDGE RUNTIME, which has no database driver.
 * We proved this by running a probe query here: Prisma throws
 * "PrismaClient is not configured to run in Edge Runtime".
 *
 * So middleware CANNOT read the user's role from the database. What it CAN do
 * is verify that the login cookie is genuine:
 *   - the token has the right shape (userId.expiresAt.signature)
 *   - the HMAC signature matches our SESSION_SECRET (so nobody forged it)
 *   - the session has not expired
 *
 * That is enough to reject anonymous visitors and tampered cookies up front.
 *
 * It is NOT enough to prove someone is an admin, because the role is not in
 * the cookie. The real authorisation check - loading the user and comparing
 * their role - still happens in every admin page and every /api/admin route
 * via requireAdmin(). This middleware is a fast first door, not the lock.
 * Never remove the requireAdmin() calls on the strength of this file.
 * ---------------------------------------------------------------------------
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * middleware
 * WHAT: Runs on every matched route and either lets the request through or
 *       redirects it to the login page.
 * WHY : One place to keep anonymous traffic off the admin area.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // Verify the cookie signature and expiry. Returns null when invalid.
  // No database access here - that is impossible in the Edge runtime.
  const valid = token ? await verifySessionToken(token) : null;

  // Valid signed session: let it through. The page's own requireAdmin()
  // check will confirm this account is actually staff.
  //
  // We also forward the requested path in a header. Server layouts cannot ask
  // Next.js "what path am I rendering?" - the request object is not available
  // to them - so the admin layout needs this to decide whether the current
  // page is one this admin's tier is allowed to open.
  if (valid) {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", request.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  }

  // No usable session. Send them to login, remembering where they wanted to
  // go so they land back on the admin page after signing in.
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * config.matcher
 * WHAT: Which paths this middleware actually runs on.
 * WHY : Running it on every route would add a redirect hop to the student app
 *       for no benefit - students never touch /admin. Scoping it here keeps
 *       the middleware cheap and the rest of the app untouched.
 *
 * The negative lookahead (?!.+_next) skips Next's own build assets
 * (/_next/static, /_next/image), which are never pages anyone logs into.
 */
export const config = {
  matcher: ["/admin", "/admin/:path*", "/admin((?!_next).*)"],
};
