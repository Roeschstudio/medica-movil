import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Enhanced Prisma client with proper connection management
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: "pretty",
  });

// Ensure proper cleanup on process termination
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;

  // Graceful shutdown handlers (only in Node.js runtime, not Edge Runtime)
  if (typeof process !== "undefined" && process.on) {
    const cleanup = async () => {
      console.log("Disconnecting Prisma client...");
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("beforeExit", cleanup);
  }
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
