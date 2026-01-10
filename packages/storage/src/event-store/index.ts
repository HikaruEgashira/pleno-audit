export { EventStore } from "./event-store.js";
export type { EventQueryOptions, EventQueryResult } from "./event-store.js";
export {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
  resetEventsMigration,
} from "./migration.js";
export { DB_CONFIG, initializeDatabase } from "./schema.js";
