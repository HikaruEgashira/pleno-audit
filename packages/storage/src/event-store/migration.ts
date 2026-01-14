/**
 * Migration utilities to move events from chrome.storage.local to ParquetStore
 */

import type { EventLog } from "@pleno-audit/detectors";

const MIGRATION_FLAG_KEY = "events_parquet_migration_completed";

/**
 * ParquetStore互換のインターフェース
 */
export interface ParquetStoreLike {
  init(): Promise<void>;
  addEvents(events: Array<{
    id?: string;
    type: string;
    domain: string;
    timestamp: number;
    details: string;
  }>): Promise<void>;
}

export async function checkEventsMigrationNeeded(): Promise<boolean> {
  const result = await chrome.storage.local.get([MIGRATION_FLAG_KEY, "events"]);

  const migrationCompleted = result[MIGRATION_FLAG_KEY] === true;
  const hasEventsInStorage = Array.isArray(result.events) && result.events.length > 0;

  return !migrationCompleted && hasEventsInStorage;
}

export async function migrateEventsToIndexedDB(
  parquetStore: ParquetStoreLike,
): Promise<{ success: boolean; migratedCount: number; error?: string }> {
  try {
    const result = await chrome.storage.local.get(["events"]);
    const events = result.events as EventLog[] | undefined;

    if (!Array.isArray(events)) {
      return { success: true, migratedCount: 0 };
    }

    if (events.length === 0) {
      return { success: true, migratedCount: 0 };
    }

    await parquetStore.init();

    // EventLogをParquetEvent形式に変換してバッチ追加
    const batchSize = 100;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const parquetEvents = batch.map(event => ({
        id: event.id,
        type: event.type,
        domain: event.domain,
        timestamp: typeof event.timestamp === "number" ? event.timestamp : Date.now(),
        details: JSON.stringify(event.details || {}),
      }));
      await parquetStore.addEvents(parquetEvents);
    }

    await chrome.storage.local.set({ [MIGRATION_FLAG_KEY]: true });
    await chrome.storage.local.remove(["events"]);

    console.log(`[ParquetStore] Migrated ${events.length} events`);

    return { success: true, migratedCount: events.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ParquetStore] Migration failed: ${errorMsg}`);
    return { success: false, migratedCount: 0, error: errorMsg };
  }
}

export async function resetEventsMigration(): Promise<void> {
  await chrome.storage.local.remove([MIGRATION_FLAG_KEY]);
}
