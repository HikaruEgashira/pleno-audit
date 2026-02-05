import { ParquetStore } from "@pleno-audit/parquet-storage";
import type { EventLog } from "./types";
import type { BackgroundServiceState } from "./state";
import type { NewEvent } from "./types";

function generateEventId(): string {
  return crypto.randomUUID();
}

export async function getOrInitParquetStore(state: BackgroundServiceState): Promise<ParquetStore> {
  if (!state.parquetStore) {
    state.parquetStore = new ParquetStore();
    await state.parquetStore.init();
  }
  return state.parquetStore;
}

export async function addEvent(state: BackgroundServiceState, event: NewEvent): Promise<EventLog> {
  const store = await getOrInitParquetStore(state);
  const eventId = generateEventId();
  const newEvent = {
    ...event,
    id: eventId,
  } as EventLog;

  const parquetEvent = {
    id: eventId,
    type: event.type,
    domain: event.domain,
    timestamp: event.timestamp ?? Date.now(),
    details: JSON.stringify(event.details || {}),
  };

  await store.addEvents([parquetEvent]);
  return newEvent;
}
