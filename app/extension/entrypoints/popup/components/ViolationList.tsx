import type { CSPViolation } from "@service-policy-auditor/csp";
import { Badge } from "../../../components";
import { styles } from "../styles";

interface Props {
  violations: CSPViolation[];
}

export function ViolationList({ violations }: Props) {
  if (violations.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>CSP違反はまだ検出されていません</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>CSP違反 ({violations.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>時間</th>
              <th style={styles.tableHeader}>Directive</th>
              <th style={styles.tableHeader}>ブロックURL</th>
            </tr>
          </thead>
          <tbody>
            {violations.slice(0, 50).map((v, i) => (
              <tr key={i} style={styles.tableRow}>
                <td style={styles.tableCell}>
                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#666" }}>
                    {formatTime(v.timestamp)}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <Badge variant={["script-src", "default-src"].includes(v.directive) ? "danger" : "default"}>
                    {v.directive}
                  </Badge>
                </td>
                <td
                  style={{ ...styles.tableCell, wordBreak: "break-all" }}
                  title={v.blockedURL}
                >
                  <code style={styles.code}>
                    {truncateUrl(v.blockedURL, 30)}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {violations.length > 50 && (
        <p style={{ color: "#999", fontSize: "11px", marginTop: "8px" }}>
          50件中{violations.length}件を表示
        </p>
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("ja-JP");
}

function truncateUrl(url: string, maxLen: number): string {
  return url.length > maxLen ? url.substring(0, maxLen) + "…" : url;
}
