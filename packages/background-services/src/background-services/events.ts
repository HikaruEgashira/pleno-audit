import { ParquetStore } from "@pleno-audit/parquet-storage";
import type { EventLog } from "./types";
import type { BackgroundServiceState } from "./state";
import type { NewEvent } from "./types";
import { resolveEventTimestamp } from "../services/event-timestamp";

let parquetStorePromise: Promise<ParquetStore> | null = null;

function generateEventId(): string {
  return crypto.randomUUID();
}

export async function getOrInitParquetStore(state: BackgroundServiceState): Promise<ParquetStore> {
  if (!state.parquetStore) {
    if (!parquetStorePromise) {
      parquetStorePromise = (async () => {
        const store = new ParquetStore();
        await store.init();
        return store;
      })().catch((error) => {
        parquetStorePromise = null;
        throw error;
      });
    }
    state.parquetStore = await parquetStorePromise;
  }
  return state.parquetStore;
}

export async function closeParquetStore(state: BackgroundServiceState): Promise<void> {
  const store = state.parquetStore ?? (parquetStorePromise ? await parquetStorePromise : null);
  if (!store) {
    parquetStorePromise = null;
    return;
  }

  await store.close();
  state.parquetStore = null;
  parquetStorePromise = null;
}

export async function addEvent(state: BackgroundServiceState, event: NewEvent): Promise<EventLog> {
  const store = await getOrInitParquetStore(state);
  const eventId = generateEventId();
  const timestamp = resolveEventTimestamp(event.timestamp, {
    logger: state.logger,
    context: `${event.type}:${event.domain}`,
  });
  const newEvent = {
    ...event,
    id: eventId,
    timestamp,
  } as EventLog;

  const parquetEvent = {
    id: eventId,
    type: event.type,
    domain: event.domain,
    timestamp,
    details: JSON.stringify(event.details || {}),
  };

  await store.addEvents([parquetEvent]);
  return newEvent;
}
