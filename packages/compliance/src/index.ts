/**
 * @fileoverview Compliance Report Package
 *
 * Generate compliance reports aligned with security frameworks
 * like SOC2, ISO27001, GDPR, etc.
 */

// Types
export type {
  ComplianceFramework,
  ComplianceStatus,
  ControlCategory,
  ComplianceControl,
  ComplianceEvidence,
  ComplianceFinding,
  ComplianceReport,
  ComplianceSummary,
  FrameworkMapping,
  FrameworkControl,
} from "./types.js";

export { SOC2_CONTROLS, GDPR_CONTROLS } from "./types.js";

// Report Generator
export {
  generateComplianceReport,
  exportReportJSON,
  exportReportMarkdown,
  type ComplianceInput,
} from "./report-generator.js";
