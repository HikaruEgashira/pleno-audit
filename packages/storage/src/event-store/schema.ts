/**
 * IndexedDB Schema for Event Storage
 */

export const DB_CONFIG = {
  name: "ServicePolicyAuditorEvents",
  version: 1,
  stores: {
    events: {
      name: "events",
      keyPath: "id",
      indexes: [
        { name: "timestamp", keyPath: "timestamp" },
        { name: "type", keyPath: "type" },
        { name: "domain", keyPath: "domain" },
        { name: "type_timestamp", keyPath: ["type", "timestamp"], unique: false },
      ],
    },
  },
};

export function initializeDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      Object.values(DB_CONFIG.stores).forEach((storeConfig) => {
        if (!db.objectStoreNames.contains(storeConfig.name)) {
          const store = db.createObjectStore(storeConfig.name, {
            keyPath: storeConfig.keyPath,
          });

          // Create indexes
          storeConfig.indexes.forEach((indexConfig) => {
            store.createIndex(indexConfig.name, indexConfig.keyPath, {
              unique: indexConfig.unique || false,
            });
          });
        }
      });
    };
  });
}
