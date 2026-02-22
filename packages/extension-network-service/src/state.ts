import type { ExtensionNetworkState } from "./types";

export function createExtensionNetworkState(): ExtensionNetworkState {
  return {
    extensionMonitor: null,
    cooldownManager: null,
  };
}
