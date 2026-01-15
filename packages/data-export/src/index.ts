/**
 * @fileoverview Data Export Package
 *
 * Export security data in various formats (JSON, CSV, Markdown, HTML).
 * Enables reporting and data portability.
 */

// Types
export type {
  ExportFormat,
  ExportDataType,
  ExportOptions,
  ExportResult,
  CSVColumn,
  SecurityReport,
  ReportMetadata,
  ReportSummary,
  ServiceExport,
  ViolationExport,
  AlertExport,
  PermissionExport,
  ComplianceExport,
  ComplianceControlExport,
  // Audit log export types
  EventLogExport,
  AIPromptExport,
  DetectedServiceExport,
  AuditLogExportOptions,
} from "./types.js";

// Exporter functions
export {
  exportData,
  downloadExport,
  toCSV,
  toJSON,
  exportServicesToCSV,
  exportViolationsToCSV,
  exportAlertsToCSV,
  exportPermissionsToCSV,
  exportReportToMarkdown,
  exportReportToHTML,
} from "./exporter.js";

// Audit log exporter functions
export {
  exportEventsToCSV,
  exportEventsToJSON,
  exportAIPromptsToCSV,
  exportAIPromptsToJSON,
  exportDetectedServicesToCSV,
  exportDetectedServicesToJSON,
  exportAuditLogToJSON,
  createExportBlob,
  generateExportFilename,
  type AuditLogData,
} from "./audit-exporter.js";
