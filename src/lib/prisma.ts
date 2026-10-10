/**
 * src/lib/prisma.ts
 * WHAT: Creates ONE shared Prisma database client for the whole app.
 * WHY : In development, Next.js reloads your files constantly. If every file
 *       made its own database connection, you would run out of connections and
 *       Postgres would start refusing new requests. Keeping one client on the
 *       global object prevents that.
 */
import { PrismaClient } from "@prisma/client";

// A single, reusable Prisma client.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// If a client already exists on `global`, reuse it; otherwise create a new one.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Log slow queries in development so you can spot performance problems.
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Remember it for the next hot reload (development only).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
