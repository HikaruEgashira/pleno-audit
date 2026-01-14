/**
 * @fileoverview Data Exporter
 *
 * Export security data in various formats (JSON, CSV, Markdown, HTML).
 */

import type {
  ExportFormat,
  ExportDataType,
  ExportOptions,
  ExportResult,
  CSVColumn,
  SecurityReport,
  ServiceExport,
  ViolationExport,
  AlertExport,
  PermissionExport,
} from "./types.js";

/**
 * Generate filename for export
 */
function generateFilename(
  dataType: ExportDataType,
  format: ExportFormat
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `pleno-audit-${dataType}-${timestamp}.${format}`;
}

/**
 * Convert data to CSV format
 */
export function toCSV<T>(
  data: T[],
  columns: CSVColumn<T>[]
): string {
  const headers = columns.map((c) => escapeCSV(c.header)).join(",");
  const rows = data.map((item) =>
    columns
      .map((col) => {
        const value = col.accessor(item);
        return escapeCSV(String(value ?? ""));
      })
      .join(",")
  );
  return [headers, ...rows].join("\n");
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert data to JSON format
 */
export function toJSON(data: unknown, prettyPrint = true): string {
  return prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Export services to CSV
 */
export function exportServicesToCSV(services: ServiceExport[]): string {
  const columns: CSVColumn<ServiceExport>[] = [
    { header: "Domain", accessor: (s) => s.domain },
    { header: "First Seen", accessor: (s) => new Date(s.firstSeen).toISOString() },
    { header: "Last Seen", accessor: (s) => new Date(s.lastSeen).toISOString() },
    { header: "Has Login", accessor: (s) => s.hasLogin },
    { header: "Has Privacy Policy", accessor: (s) => s.hasPrivacyPolicy },
    { header: "Has ToS", accessor: (s) => s.hasTermsOfService },
    { header: "Is NRD", accessor: (s) => s.isNRD },
    { header: "NRD Confidence", accessor: (s) => s.nrdConfidence || "" },
    { header: "Is Typosquat", accessor: (s) => s.isTyposquat },
    { header: "Typosquat Confidence", accessor: (s) => s.typosquatConfidence || "" },
    { header: "Cookie Count", accessor: (s) => s.cookieCount },
    { header: "Risk Score", accessor: (s) => s.riskScore },
  ];
  return toCSV(services, columns);
}

/**
 * Export violations to CSV
 */
export function exportViolationsToCSV(violations: ViolationExport[]): string {
  const columns: CSVColumn<ViolationExport>[] = [
    { header: "ID", accessor: (v) => v.id },
    { header: "Type", accessor: (v) => v.type },
    { header: "Domain", accessor: (v) => v.domain },
    { header: "Severity", accessor: (v) => v.severity },
    { header: "Description", accessor: (v) => v.description },
    { header: "Timestamp", accessor: (v) => new Date(v.timestamp).toISOString() },
    { header: "Acknowledged", accessor: (v) => v.acknowledged },
  ];
  return toCSV(violations, columns);
}

/**
 * Export alerts to CSV
 */
export function exportAlertsToCSV(alerts: AlertExport[]): string {
  const columns: CSVColumn<AlertExport>[] = [
    { header: "ID", accessor: (a) => a.id },
    { header: "Title", accessor: (a) => a.title },
    { header: "Severity", accessor: (a) => a.severity },
    { header: "Category", accessor: (a) => a.category },
    { header: "Description", accessor: (a) => a.description },
    { header: "Domain", accessor: (a) => a.domain || "" },
    { header: "Timestamp", accessor: (a) => new Date(a.timestamp).toISOString() },
    { header: "Status", accessor: (a) => a.status },
  ];
  return toCSV(alerts, columns);
}

/**
 * Export permissions to CSV
 */
export function exportPermissionsToCSV(permissions: PermissionExport[]): string {
  const columns: CSVColumn<PermissionExport>[] = [
    { header: "Extension ID", accessor: (p) => p.extensionId },
    { header: "Extension Name", accessor: (p) => p.extensionName },
    { header: "Risk Score", accessor: (p) => p.riskScore },
    { header: "Risk Level", accessor: (p) => p.riskLevel },
    { header: "Permissions", accessor: (p) => p.permissions.join("; ") },
    { header: "Findings Count", accessor: (p) => p.findingsCount },
    { header: "Analyzed At", accessor: (p) => new Date(p.analyzedAt).toISOString() },
  ];
  return toCSV(permissions, columns);
}

/**
 * Export full report to Markdown
 */
export function exportReportToMarkdown(report: SecurityReport): string {
  const lines: string[] = [];

  // Header
  lines.push("# Pleno Audit Security Report");
  lines.push("");
  lines.push(
    `Generated: ${new Date(report.metadata.generatedAt).toLocaleString("ja-JP")}`
  );
  lines.push(
    `Period: ${new Date(report.metadata.reportPeriod.start).toLocaleDateString("ja-JP")} - ${new Date(report.metadata.reportPeriod.end).toLocaleDateString("ja-JP")}`
  );
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Security Score**: ${report.summary.securityScore}/100`);
  lines.push(`- **Total Services**: ${report.summary.totalServices}`);
  lines.push(`- **Total Violations**: ${report.summary.totalViolations}`);
  lines.push(`- **Total Alerts**: ${report.summary.totalAlerts}`);
  lines.push("");

  // Risk Distribution
  lines.push("### Risk Distribution");
  lines.push("");
  for (const [level, count] of Object.entries(report.summary.riskDistribution)) {
    lines.push(`- ${level}: ${count}`);
  }
  lines.push("");

  // Top Risks
  if (report.summary.topRisks.length > 0) {
    lines.push("### Top Risks");
    lines.push("");
    for (const risk of report.summary.topRisks) {
      lines.push(`1. ${risk}`);
    }
    lines.push("");
  }

  // Services
  if (report.services.length > 0) {
    lines.push("## Detected Services");
    lines.push("");
    lines.push("| Domain | Risk Score | NRD | Typosquat | Login |");
    lines.push("|--------|------------|-----|-----------|-------|");
    for (const service of report.services.slice(0, 20)) {
      lines.push(
        `| ${service.domain} | ${service.riskScore} | ${service.isNRD ? "Yes" : "No"} | ${service.isTyposquat ? "Yes" : "No"} | ${service.hasLogin ? "Yes" : "No"} |`
      );
    }
    if (report.services.length > 20) {
      lines.push(`\n*...and ${report.services.length - 20} more services*`);
    }
    lines.push("");
  }

  // Violations
  if (report.violations.length > 0) {
    lines.push("## Policy Violations");
    lines.push("");
    for (const violation of report.violations.slice(0, 10)) {
      lines.push(`### ${violation.type} - ${violation.domain}`);
      lines.push(`- **Severity**: ${violation.severity}`);
      lines.push(`- **Description**: ${violation.description}`);
      lines.push(
        `- **Time**: ${new Date(violation.timestamp).toLocaleString("ja-JP")}`
      );
      lines.push("");
    }
    if (report.violations.length > 10) {
      lines.push(`*...and ${report.violations.length - 10} more violations*`);
      lines.push("");
    }
  }

  // Alerts
  if (report.alerts.length > 0) {
    lines.push("## Security Alerts");
    lines.push("");
    lines.push("| Severity | Title | Domain | Status |");
    lines.push("|----------|-------|--------|--------|");
    for (const alert of report.alerts.slice(0, 15)) {
      lines.push(
        `| ${alert.severity} | ${alert.title} | ${alert.domain || "-"} | ${alert.status} |`
      );
    }
    if (report.alerts.length > 15) {
      lines.push(`\n*...and ${report.alerts.length - 15} more alerts*`);
    }
    lines.push("");
  }

  // Permissions
  if (report.permissions.length > 0) {
    lines.push("## Extension Permissions");
    lines.push("");
    for (const perm of report.permissions.slice(0, 10)) {
      lines.push(`### ${perm.extensionName}`);
      lines.push(`- **Risk Level**: ${perm.riskLevel} (${perm.riskScore}/100)`);
      lines.push(`- **Findings**: ${perm.findingsCount}`);
      lines.push(`- **Permissions**: ${perm.permissions.slice(0, 5).join(", ")}`);
      if (perm.permissions.length > 5) {
        lines.push(`  *...and ${perm.permissions.length - 5} more*`);
      }
      lines.push("");
    }
  }

  // Compliance
  if (report.compliance) {
    lines.push("## Compliance Status");
    lines.push("");
    lines.push(`- **Framework**: ${report.compliance.framework}`);
    lines.push(`- **Overall Score**: ${report.compliance.overallScore}%`);
    lines.push(`- **Controls Passed**: ${report.compliance.controlsPassed}`);
    lines.push(`- **Controls Failed**: ${report.compliance.controlsFailed}`);
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("*Report generated by Pleno Audit*");

  return lines.join("\n");
}

/**
 * Export full report to HTML
 */
export function exportReportToHTML(report: SecurityReport): string {
  const scoreColor =
    report.summary.securityScore >= 80
      ? "#22c55e"
      : report.summary.securityScore >= 60
        ? "#eab308"
        : report.summary.securityScore >= 40
          ? "#f97316"
          : "#dc2626";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pleno Audit Security Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #ededed;
      line-height: 1.6;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1, h2, h3 { margin-bottom: 16px; }
    h1 { font-size: 28px; border-bottom: 1px solid #333; padding-bottom: 16px; }
    h2 { font-size: 20px; margin-top: 32px; color: #a1a1a1; }
    .meta { color: #666; font-size: 14px; margin-bottom: 24px; }
    .score-card {
      background: linear-gradient(135deg, #1a1a1a, #0d0d0d);
      border: 1px solid #333;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-bottom: 24px;
    }
    .score { font-size: 64px; font-weight: bold; color: ${scoreColor}; }
    .score-label { color: #666; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-value { font-size: 24px; font-weight: bold; color: #ededed; }
    .stat-label { font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #1a1a1a; font-weight: 600; font-size: 12px; color: #a1a1a1; text-transform: uppercase; }
    td { font-size: 14px; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-critical { background: rgba(220,38,38,0.2); color: #dc2626; }
    .badge-high { background: rgba(249,115,22,0.2); color: #f97316; }
    .badge-medium { background: rgba(234,179,8,0.2); color: #eab308; }
    .badge-low { background: rgba(34,197,94,0.2); color: #22c55e; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #333; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Pleno Audit Security Report</h1>
    <div class="meta">
      Generated: ${new Date(report.metadata.generatedAt).toLocaleString("ja-JP")} |
      Period: ${new Date(report.metadata.reportPeriod.start).toLocaleDateString("ja-JP")} - ${new Date(report.metadata.reportPeriod.end).toLocaleDateString("ja-JP")}
    </div>

    <div class="score-card">
      <div class="score">${report.summary.securityScore}</div>
      <div class="score-label">Security Score</div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${report.summary.totalServices}</div>
        <div class="stat-label">Services</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.summary.totalViolations}</div>
        <div class="stat-label">Violations</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.summary.totalAlerts}</div>
        <div class="stat-label">Alerts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.permissions.length}</div>
        <div class="stat-label">Permissions</div>
      </div>
    </div>

    ${report.services.length > 0 ? `
    <h2>Detected Services</h2>
    <table>
      <thead>
        <tr><th>Domain</th><th>Risk</th><th>NRD</th><th>Typosquat</th><th>Login</th></tr>
      </thead>
      <tbody>
        ${report.services.slice(0, 20).map((s) => `
          <tr>
            <td>${s.domain}</td>
            <td>${s.riskScore}</td>
            <td>${s.isNRD ? '<span class="badge badge-high">Yes</span>' : "No"}</td>
            <td>${s.isTyposquat ? '<span class="badge badge-medium">Yes</span>' : "No"}</td>
            <td>${s.hasLogin ? "Yes" : "No"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ` : ""}

    ${report.violations.length > 0 ? `
    <h2>Policy Violations</h2>
    <table>
      <thead>
        <tr><th>Type</th><th>Domain</th><th>Severity</th><th>Description</th></tr>
      </thead>
      <tbody>
        ${report.violations.slice(0, 10).map((v) => `
          <tr>
            <td>${v.type}</td>
            <td>${v.domain}</td>
            <td><span class="badge badge-${v.severity}">${v.severity}</span></td>
            <td>${v.description}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ` : ""}

    <div class="footer">
      Report generated by Pleno Audit v${report.metadata.version}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main export function
 */
export function exportData(
  data: unknown,
  options: ExportOptions
): ExportResult {
  const { format, dataType, prettyPrint = true } = options;
  const filename = generateFilename(dataType, format);

  try {
    let content: string;
    let recordCount = 0;

    if (dataType === "full_report" && format === "markdown") {
      content = exportReportToMarkdown(data as SecurityReport);
      recordCount = 1;
    } else if (dataType === "full_report" && format === "html") {
      content = exportReportToHTML(data as SecurityReport);
      recordCount = 1;
    } else if (format === "json") {
      content = toJSON(data, prettyPrint);
      recordCount = Array.isArray(data) ? data.length : 1;
    } else if (format === "csv") {
      switch (dataType) {
        case "services":
          content = exportServicesToCSV(data as ServiceExport[]);
          recordCount = (data as ServiceExport[]).length;
          break;
        case "violations":
          content = exportViolationsToCSV(data as ViolationExport[]);
          recordCount = (data as ViolationExport[]).length;
          break;
        case "alerts":
          content = exportAlertsToCSV(data as AlertExport[]);
          recordCount = (data as AlertExport[]).length;
          break;
        case "permissions":
          content = exportPermissionsToCSV(data as PermissionExport[]);
          recordCount = (data as PermissionExport[]).length;
          break;
        default:
          content = toJSON(data, prettyPrint);
          recordCount = Array.isArray(data) ? data.length : 1;
      }
    } else {
      content = toJSON(data, prettyPrint);
      recordCount = Array.isArray(data) ? data.length : 1;
    }

    return {
      success: true,
      format,
      dataType,
      content,
      filename,
      recordCount,
      exportedAt: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      format,
      dataType,
      content: "",
      filename,
      recordCount: 0,
      exportedAt: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download helper for browser
 */
export function downloadExport(result: ExportResult): void {
  if (!result.success) {
    throw new Error(result.error || "Export failed");
  }

  const mimeTypes: Record<ExportFormat, string> = {
    json: "application/json",
    csv: "text/csv",
    markdown: "text/markdown",
    html: "text/html",
  };

  const blob = new Blob([result.content], {
    type: mimeTypes[result.format],
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
