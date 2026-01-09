import type { CSPViolation } from "@service-policy-controller/core";
import { styles } from "../styles";

interface Props {
  violations: CSPViolation[];
}

export function ViolationList({ violations }: Props) {
  if (violations.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No CSP violations detected yet</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>CSP Violations ({violations.length})</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Time</th>
            <th style={styles.tableHeader}>Directive</th>
            <th style={styles.tableHeader}>Blocked URL</th>
          </tr>
        </thead>
        <tbody>
          {violations.slice(0, 50).map((v, i) => (
            <tr key={i} style={styles.tableRow}>
              <td style={styles.tableCell}>{formatTime(v.timestamp)}</td>
              <td style={styles.tableCell}>
                <span style={styles.code}>{v.directive}</span>
              </td>
              <td
                style={{ ...styles.tableCell, wordBreak: "break-all" }}
                title={v.blockedURL}
              >
                <code style={{ fontSize: "11px" }}>
                  {truncateUrl(v.blockedURL, 30)}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {violations.length > 50 && (
        <p style={{ color: "hsl(0 0% 60%)", fontSize: "11px", marginTop: "8px" }}>
          Showing 50 of {violations.length} violations
        </p>
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function truncateUrl(url: string, maxLen: number): string {
  return url.length > maxLen ? url.substring(0, maxLen) + "…" : url;
}
