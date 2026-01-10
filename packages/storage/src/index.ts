// Event Store
export { EventStore } from "./event-store/event-store.js";
export type { EventQueryOptions, EventQueryResult } from "./event-store/event-store.js";
export {
  checkEventsMigrationNeeded,
  migrateEventsToIndexedDB,
  resetEventsMigration,
} from "./event-store/migration.js";
export { DB_CONFIG, initializeDatabase } from "./event-store/schema.js";
