/**
 * @fileoverview Compliance Report Types
 *
 * Types for generating compliance reports aligned with
 * security frameworks like SOC2, ISO27001, GDPR, etc.
 */

/**
 * Compliance framework
 */
export type ComplianceFramework =
  | "soc2" // SOC 2 Type II
  | "iso27001" // ISO 27001
  | "gdpr" // GDPR
  | "ccpa" // CCPA
  | "hipaa" // HIPAA
  | "pci-dss" // PCI DSS
  | "nist" // NIST Cybersecurity Framework
  | "custom";

/**
 * Compliance status
 */
export type ComplianceStatus =
  | "compliant" // Meets requirements
  | "partial" // Partially meets requirements
  | "non_compliant" // Does not meet requirements
  | "not_applicable" // N/A for this context
  | "unknown"; // Not enough data

/**
 * Control category
 */
export type ControlCategory =
  | "access_control" // Access management
  | "data_protection" // Data security
  | "network_security" // Network controls
  | "incident_response" // Incident handling
  | "risk_management" // Risk assessment
  | "vendor_management" // Third-party risk
  | "privacy" // Privacy controls
  | "monitoring" // Logging and monitoring
  | "encryption" // Encryption requirements
  | "policy"; // Policy documentation

/**
 * Compliance control
 */
export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  category: ControlCategory;
  name: string;
  description: string;
  requirement: string;
  status: ComplianceStatus;
  evidence: ComplianceEvidence[];
  findings: ComplianceFinding[];
  lastChecked: number;
}

/**
 * Evidence supporting compliance
 */
export interface ComplianceEvidence {
  type: "policy" | "log" | "config" | "scan" | "manual";
  description: string;
  source: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * Compliance finding
 */
export interface ComplianceFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  recommendation: string;
  affectedAssets: string[];
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  generatedAt: number;
  period: {
    start: number;
    end: number;
  };
  summary: ComplianceSummary;
  controls: ComplianceControl[];
  recommendations: string[];
  metadata: {
    totalDomains: number;
    totalEvents: number;
    scanDuration: number;
  };
}

/**
 * Compliance summary
 */
export interface ComplianceSummary {
  overallStatus: ComplianceStatus;
  score: number; // 0-100
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  nonCompliantControls: number;
  notApplicableControls: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
}

/**
 * Framework-specific control mappings
 */
export interface FrameworkMapping {
  framework: ComplianceFramework;
  controls: FrameworkControl[];
}

/**
 * Framework control definition
 */
export interface FrameworkControl {
  controlId: string;
  name: string;
  description: string;
  category: ControlCategory;
  checkFn: string; // Function name for checking
}

/**
 * SOC 2 Trust Services Criteria mapping
 */
export const SOC2_CONTROLS: FrameworkControl[] = [
  {
    controlId: "CC6.1",
    name: "Logical Access Security",
    description: "The entity implements logical access security software, infrastructure, and architectures",
    category: "access_control",
    checkFn: "checkAccessControl",
  },
  {
    controlId: "CC6.6",
    name: "System Boundaries",
    description: "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software",
    category: "network_security",
    checkFn: "checkMalwareProtection",
  },
  {
    controlId: "CC6.7",
    name: "Data Transmission Protection",
    description: "The entity restricts the transmission, movement, and removal of information",
    category: "data_protection",
    checkFn: "checkDataTransmission",
  },
  {
    controlId: "CC7.2",
    name: "Security Event Monitoring",
    description: "The entity monitors system components and the operation of those components",
    category: "monitoring",
    checkFn: "checkMonitoring",
  },
  {
    controlId: "CC7.3",
    name: "Security Incident Response",
    description: "The entity evaluates security events to determine whether they could or have resulted in a failure",
    category: "incident_response",
    checkFn: "checkIncidentResponse",
  },
];

/**
 * GDPR Article mapping
 */
export const GDPR_CONTROLS: FrameworkControl[] = [
  {
    controlId: "Art.5",
    name: "Data Processing Principles",
    description: "Personal data shall be processed lawfully, fairly and in a transparent manner",
    category: "privacy",
    checkFn: "checkPrivacyPolicy",
  },
  {
    controlId: "Art.13",
    name: "Information to Data Subject",
    description: "Information to be provided where personal data are collected",
    category: "privacy",
    checkFn: "checkPrivacyNotice",
  },
  {
    controlId: "Art.25",
    name: "Data Protection by Design",
    description: "Implement appropriate technical and organisational measures",
    category: "data_protection",
    checkFn: "checkDataProtection",
  },
  {
    controlId: "Art.32",
    name: "Security of Processing",
    description: "Implement appropriate security measures",
    category: "encryption",
    checkFn: "checkEncryption",
  },
  {
    controlId: "Art.33",
    name: "Breach Notification",
    description: "Notification of personal data breach to supervisory authority",
    category: "incident_response",
    checkFn: "checkBreachResponse",
  },
];
