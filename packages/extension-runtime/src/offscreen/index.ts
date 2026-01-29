/**
 * @fileoverview Offscreen Package (Shim)
 *
 * This module is a backward-compatibility shim that re-exports from runtime-platform.
 * New code should import directly from @pleno-audit/runtime-platform/offscreen.
 *
 * @deprecated Import from @pleno-audit/runtime-platform/offscreen instead
 */

export {
  type LocalApiRequest,
  type LocalApiResponse,
  type LegacyDBMessage,
  type LegacyDBResponse,
  type ClearAllIndexedDBMessage,
  type ClearAllIndexedDBResponse,
  type DBMessage,
  type DBResponse,
  isLocalApiRequest,
  IndexedDBStorage,
} from "@pleno-audit/runtime-platform/offscreen";
