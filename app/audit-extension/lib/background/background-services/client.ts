import type { ApiClient, ConnectionMode, SyncManager } from "@pleno-audit/extension-runtime";
import { getApiClient, getSyncManager, updateApiClientConfig } from "@pleno-audit/extension-runtime";
import type { BackgroundServiceState } from "./state";

export async function ensureApiClient(state: BackgroundServiceState): Promise<ApiClient> {
  if (!state.apiClient) {
    state.apiClient = await getApiClient();
  }
  return state.apiClient;
}

export async function ensureSyncManager(state: BackgroundServiceState): Promise<SyncManager> {
  if (!state.syncManager) {
    state.syncManager = await getSyncManager();
  }
  return state.syncManager;
}

export async function initializeApiClientWithMigration(
  state: BackgroundServiceState,
  checkMigrationNeeded: () => Promise<boolean>,
  migrateToDatabase: () => Promise<void>
): Promise<void> {
  const client = await getApiClient();
  state.apiClient = client;

  const needsMigration = await checkMigrationNeeded();
  if (needsMigration) {
    await migrateToDatabase();
  }
}

export async function initializeSyncManagerWithAutoStart(state: BackgroundServiceState): Promise<void> {
  const manager = await getSyncManager();
  state.syncManager = manager;
  if (manager.isEnabled()) {
    await manager.startSync();
  }
}

export async function setConnectionConfig(
  state: BackgroundServiceState,
  mode: ConnectionMode,
  endpoint?: string
): Promise<{ success: boolean }> {
  try {
    await updateApiClientConfig(mode, endpoint);
    return { success: true };
  } catch (error) {
    state.logger?.error("Error setting connection config:", error);
    return { success: false };
  }
}
