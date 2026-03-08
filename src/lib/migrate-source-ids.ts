import { prisma } from "@/lib/prisma";
import { getServerConfig, setServerConfig } from "@/lib/server-config";
import { SOURCE_ID_MIGRATION } from "@/config/source-id-migration";

const MIGRATION_KEY = "sourceIdsMigrated";

/**
 * One-time migration: update old source IDs to canonical SOURCE_LIBRARY IDs
 * in Article rows, UserSettings, and ServerDefaultSources.
 */
export async function migrateSourceIds(): Promise<void> {
  const already = await getServerConfig(MIGRATION_KEY);
  if (already === "true") return;

  const oldIds = Object.keys(SOURCE_ID_MIGRATION);

  console.log("[migrate-source-ids] Running one-time source ID migration…");

  // 1. Migrate Article.sourceId
  for (const [oldId, newId] of Object.entries(SOURCE_ID_MIGRATION)) {
    await prisma.$executeRawUnsafe(
      `UPDATE Article SET sourceId = ? WHERE sourceId = ?`,
      newId,
      oldId
    );
  }

  // 2. Migrate UserSettings.sources and disabledSourceIds
  const allSettings = await prisma.userSettings.findMany({
    select: { id: true, sources: true, disabledSourceIds: true },
  });

  for (const row of allSettings) {
    let changed = false;

    // Migrate sources JSON
    let sources: Array<{ id: string; [k: string]: unknown }> = [];
    try {
      sources = JSON.parse(row.sources);
    } catch {
      continue;
    }
    const newSources = sources.map((s) => {
      const mapped = SOURCE_ID_MIGRATION[s.id];
      if (mapped) {
        changed = true;
        return { ...s, id: mapped };
      }
      return s;
    });

    // Migrate disabledSourceIds JSON
    let disabled: string[] = [];
    try {
      disabled = JSON.parse(row.disabledSourceIds);
    } catch {
      disabled = [];
    }
    const newDisabled = disabled.map((id) => {
      const mapped = SOURCE_ID_MIGRATION[id];
      if (mapped) {
        changed = true;
        return mapped;
      }
      return id;
    });

    if (changed) {
      await prisma.userSettings.update({
        where: { id: row.id },
        data: {
          sources: JSON.stringify(newSources),
          disabledSourceIds: JSON.stringify(newDisabled),
        },
      });
    }
  }

  // 3. Migrate ServerDefaultSources
  const defaults = await prisma.serverDefaultSources.findMany({
    select: { id: true, sources: true },
  });

  for (const row of defaults) {
    let sources: Array<{ id: string; [k: string]: unknown }> = [];
    try {
      sources = JSON.parse(row.sources);
    } catch {
      continue;
    }
    let changed = false;
    const newSources = sources.map((s) => {
      const mapped = SOURCE_ID_MIGRATION[s.id];
      if (mapped) {
        changed = true;
        return { ...s, id: mapped };
      }
      return s;
    });

    if (changed) {
      await prisma.serverDefaultSources.update({
        where: { id: row.id },
        data: { sources: JSON.stringify(newSources) },
      });
    }
  }

  await setServerConfig(MIGRATION_KEY, "true");
  console.log("[migrate-source-ids] Migration complete.");
}
