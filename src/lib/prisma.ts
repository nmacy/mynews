import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaInitialized: boolean;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Enable WAL mode for concurrent reads during writes, and set a busy timeout
// so readers don't fail immediately when a write is in progress.
if (!globalForPrisma.prismaInitialized) {
  globalForPrisma.prismaInitialized = true;
  prisma
    .$executeRawUnsafe("PRAGMA journal_mode = WAL")
    .then(() => prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000"))
    .catch(() => {});
}
