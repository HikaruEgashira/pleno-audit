import { ParquetStore } from "@pleno-audit/parquet-storage";
import type { EventLog } from "./types";
import type { BackgroundServiceState } from "./state";
import type { NewEvent } from "./types";
import { resolveEventTimestamp } from "../services/event-timestamp";

type StorePhase = "idle" | "initializing" | "closing";

class ParquetStoreManager {
  private phase: StorePhase = "idle";
  private transitionPromise: Promise<ParquetStore> | null = null;

  async getOrInit(state: BackgroundServiceState): Promise<ParquetStore> {
    if (state.parquetStore) return state.parquetStore;

    if (this.phase === "closing" && this.transitionPromise) {
      await this.transitionPromise.catch(() => {});
    }

    if (this.phase === "initializing" && this.transitionPromise) {
      state.parquetStore = await this.transitionPromise;
      return state.parquetStore;
    }

    this.phase = "initializing";
    this.transitionPromise = (async () => {
      const store = new ParquetStore();
      await store.init();
      return store;
    })();

    try {
      const store = await this.transitionPromise;
      this.phase = "idle";
      state.parquetStore = store;
      return store;
    } catch (error) {
      this.phase = "idle";
      this.transitionPromise = null;
      throw error;
    }
  }

  async close(state: BackgroundServiceState): Promise<void> {
    if (this.phase === "closing" && this.transitionPromise) {
      await this.transitionPromise.catch(() => {});
      return;
    }

    const store = state.parquetStore ?? (this.transitionPromise ? await this.transitionPromise.catch(() => null) : null);
    if (!store) {
      this.transitionPromise = null;
      return;
    }

    this.phase = "closing";
    // Use a void-returning wrapper to match the field type during close
    const closePromise = store.close().then(() => store);
    this.transitionPromise = closePromise;

    try {
      await closePromise;
    } finally {
      state.parquetStore = null;
      this.phase = "idle";
      this.transitionPromise = null;
    }
  }
}

const storeManager = new ParquetStoreManager();

function generateEventId(): string {
  return crypto.randomUUID();
}

export async function getOrInitParquetStore(state: BackgroundServiceState): Promise<ParquetStore> {
  return storeManager.getOrInit(state);
}

export async function closeParquetStore(state: BackgroundServiceState): Promise<void> {
  return storeManager.close(state);
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
