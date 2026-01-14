/**
 * @fileoverview Permission Analyzer Package
 *
 * CIEM-style permission analysis for browser extensions and websites.
 * Analyzes permissions, detects excessive privileges, and tracks changes.
 */

// Types
export type {
  ExtensionPermissionType,
  PermissionRisk,
  PermissionCategory,
  ExtensionPermission,
  WebPermissionType,
  WebPermission,
  ExtensionAnalysis,
  PermissionFinding,
  FindingType,
  PermissionSummary,
  PermissionBaseline,
  PermissionChange,
} from "./types.js";

export {
  PERMISSION_METADATA,
  DANGEROUS_COMBINATIONS,
} from "./types.js";

// Analyzer
export {
  createPermissionAnalyzer,
  createInMemoryPermissionStore,
  type PermissionAnalyzer,
  type PermissionAnalyzerStore,
  type PermissionChangeListener,
  type ExtensionManifest,
} from "./analyzer.js";
