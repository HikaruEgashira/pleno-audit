import type { DetectedService } from "@service-policy-auditor/detectors";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";

interface Props {
  services: DetectedService[];
}

export function NRDList({ services }: Props) {
  const styles = usePopupStyles();
  const nrdServices = services.filter((s) => s.nrdResult?.isNRD);

  if (nrdServices.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>新規登録ドメインは検出されていません</p>
      </div>
    );
  }

  const sorted = [...nrdServices].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>新規登録ドメイン ({nrdServices.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>ドメイン</th>
              <th style={styles.tableHeader}>経過日数</th>
              <th style={styles.tableHeader}>信頼度</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((service) => (
              <NRDRow key={service.domain} service={service} styles={styles} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NRDRow({ service, styles }: { service: DetectedService; styles: ReturnType<typeof usePopupStyles> }) {
  const nrdResult = service.nrdResult;

  if (!nrdResult?.isNRD) return null;

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <code style={styles.code}>{service.domain}</code>
      </td>
      <td style={styles.tableCell}>
        <span>{nrdResult.domainAge !== null ? `${nrdResult.domainAge}日` : "?"}</span>
      </td>
      <td style={styles.tableCell}>
        <Badge variant={nrdResult.confidence === "high" ? "danger" : "warning"}>
          {nrdResult.confidence === "high" ? "高" : "中"}
        </Badge>
      </td>
    </tr>
  );
}
