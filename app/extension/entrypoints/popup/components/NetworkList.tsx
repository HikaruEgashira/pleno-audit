import type { NetworkRequest } from "@service-policy-auditor/csp";
import { styles } from "../styles";

interface Props {
  requests: NetworkRequest[];
}

export function NetworkList({ requests }: Props) {
  if (requests.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No network requests detected yet</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Network Requests ({requests.length})</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Time</th>
            <th style={styles.tableHeader}>Type</th>
            <th style={styles.tableHeader}>Method</th>
            <th style={styles.tableHeader}>From</th>
            <th style={styles.tableHeader}>Domain</th>
          </tr>
        </thead>
        <tbody>
          {requests.slice(0, 50).map((r, i) => (
            <tr key={i} style={styles.tableRow}>
              <td style={styles.tableCell}>{formatTime(r.timestamp)}</td>
              <td style={styles.tableCell}>
                <span style={styles.badge}>{r.initiator}</span>
              </td>
              <td style={styles.tableCell}>
                <span style={styles.code}>{r.method}</span>
              </td>
              <td style={{ ...styles.tableCell, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.pageUrl}>
                {r.pageUrl}
              </td>
              <td style={styles.tableCell}>{r.domain}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {requests.length > 50 && (
        <p style={{ color: "hsl(0 0% 60%)", fontSize: "11px", marginTop: "8px" }}>
          Showing 50 of {requests.length} requests
        </p>
      )}
    </div>
  );
}

function formatTime(timestamp: string | number): string {
  const ms =
    typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  return new Date(ms).toLocaleTimeString();
}
