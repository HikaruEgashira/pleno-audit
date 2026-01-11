/**
 * Migration utilities to move events from chrome.storage.local to IndexedDB
 */

import type { EventLog } from "@pleno-audit/detectors";
import { EventStore } from "./event-store.js";

const MIGRATION_FLAG_KEY = "events_indexeddb_migration_completed";

export async function checkEventsMigrationNeeded(): Promise<boolean> {
  const result = await chrome.storage.local.get([MIGRATION_FLAG_KEY, "events"]);

  const migrationCompleted = result[MIGRATION_FLAG_KEY] === true;
  const hasEventsInStorage = Array.isArray(result.events) && result.events.length > 0;

  return !migrationCompleted && hasEventsInStorage;
}

export async function migrateEventsToIndexedDB(
  eventStore: EventStore,
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

    await eventStore.init();

    const batchSize = 100;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      await eventStore.addBatch(batch);
    }

    await chrome.storage.local.set({ [MIGRATION_FLAG_KEY]: true });
    await chrome.storage.local.remove(["events"]);

    console.log(`[EventStore] Migrated ${events.length} events to IndexedDB`);

    return { success: true, migratedCount: events.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[EventStore] Migration failed: ${errorMsg}`);
    return { success: false, migratedCount: 0, error: errorMsg };
  }
}

export async function resetEventsMigration(): Promise<void> {
  await chrome.storage.local.remove([MIGRATION_FLAG_KEY]);
}
