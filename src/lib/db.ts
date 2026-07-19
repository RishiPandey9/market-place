import { PrismaClient } from "@prisma/client";

// Prisma client singleton.
// In development, Next.js hot-reload re-evaluates modules on every change,
// which would otherwise spawn a new PrismaClient (and a new connection pool)
// on each reload and exhaust database connections. We cache the instance on
// the global object so a single client is reused across reloads.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
