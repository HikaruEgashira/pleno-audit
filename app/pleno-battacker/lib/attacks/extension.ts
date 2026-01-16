import type { AttackResult, AttackTest } from "../types";

async function simulateExtensionEnumeration(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const extensions = await chrome.management.getAll();
    const enabledExtensions = extensions.filter((ext) => ext.enabled);

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `Enumerated ${enabledExtensions.length} enabled extensions`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Extension enumeration blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateStorageAccess(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const localData = await chrome.storage.local.get(null);
    const syncData = await chrome.storage.sync.get(null);

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `Storage access successful. Local: ${Object.keys(localData).length} keys, Sync: ${Object.keys(syncData).length} keys`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Storage access blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulatePermissionAbuse(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const permissions = await chrome.permissions.getAll();
    const executionTime = performance.now() - startTime;

    const dangerousPermissions = permissions.permissions?.filter((p) =>
      ["tabs", "history", "webRequest", "cookies", "<all_urls>"].includes(p),
    );

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: `Permission check: ${dangerousPermissions?.length ?? 0} potentially dangerous permissions active`,
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Permission access blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const extensionAttacks: AttackTest[] = [
  {
    id: "extension-enum",
    name: "Extension Enumeration",
    category: "extension",
    description: "Attempts to list all installed browser extensions",
    severity: "medium",
    simulate: simulateExtensionEnumeration,
  },
  {
    id: "extension-storage",
    name: "Storage Access",
    category: "extension",
    description: "Attempts to read extension storage data",
    severity: "medium",
    simulate: simulateStorageAccess,
  },
  {
    id: "extension-permission",
    name: "Permission Abuse",
    category: "extension",
    description: "Checks for and attempts to use dangerous permissions",
    severity: "high",
    simulate: simulatePermissionAbuse,
  },
];
