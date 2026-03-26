import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaInitialized: boolean;
  prismaReady: Promise<void>;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Enable WAL mode and performance PRAGMAs.
// Awaitable via `prismaReady` so callers can ensure PRAGMAs are set before first query.
if (!globalForPrisma.prismaInitialized) {
  globalForPrisma.prismaInitialized = true;
  globalForPrisma.prismaReady = prisma
    .$executeRawUnsafe("PRAGMA journal_mode = WAL")
    .then(() => prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA cache_size = -20000"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA mmap_size = 268435456"))
    .then(() => prisma.$executeRawUnsafe("PRAGMA temp_store = MEMORY"))
    .then(() => { /* PRAGMAs initialized */ })
    .catch((err) => console.error("[prisma] PRAGMA initialization failed:", err));
} else {
  globalForPrisma.prismaReady = globalForPrisma.prismaReady ?? Promise.resolve();
}

/** Resolves when all SQLite PRAGMAs have been applied. */
export const prismaReady: Promise<void> = globalForPrisma.prismaReady;
