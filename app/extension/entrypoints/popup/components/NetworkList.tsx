import type { NetworkRequest } from "@pleno-audit/csp";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";
import { useTheme } from "../../../lib/theme";

interface Props {
  requests: NetworkRequest[];
}

export function NetworkList({ requests }: Props) {
  const styles = usePopupStyles();
  const { colors } = useTheme();

  if (requests.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>ネットワークリクエストはまだ検出されていません</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>ネットワーク ({requests.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>時間</th>
              <th style={styles.tableHeader}>Type</th>
              <th style={styles.tableHeader}>ドメイン</th>
            </tr>
          </thead>
          <tbody>
            {requests.slice(0, 50).map((r, i) => (
              <tr key={i} style={styles.tableRow}>
                <td style={styles.tableCell}>
                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: colors.textSecondary }}>
                    {formatTime(r.timestamp)}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  <Badge>{r.initiator}</Badge>
                </td>
                <td style={styles.tableCell}>
                  <code style={styles.code}>{r.domain}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {requests.length > 50 && (
        <p style={{ color: colors.textMuted, fontSize: "11px", marginTop: "8px" }}>
          50件中{requests.length}件を表示
        </p>
      )}
    </div>
  );
}

function formatTime(timestamp: string | number): string {
  const ms =
    typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  return new Date(ms).toLocaleTimeString("ja-JP");
}
