import type { DetectedService } from "@service-policy-auditor/detectors";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";

interface Props {
  services: DetectedService[];
}

export function TyposquatList({ services }: Props) {
  const styles = usePopupStyles();
  const typosquatServices = services.filter((s) => s.typosquatResult?.isTyposquat);

  if (typosquatServices.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>タイポスクワッティングは検出されていません</p>
      </div>
    );
  }

  const sorted = [...typosquatServices].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>タイポスクワッティング疑い ({typosquatServices.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>ドメイン</th>
              <th style={styles.tableHeader}>スコア</th>
              <th style={styles.tableHeader}>信頼度</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((service) => (
              <TyposquatRow key={service.domain} service={service} styles={styles} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TyposquatRow({
  service,
  styles,
}: {
  service: DetectedService;
  styles: ReturnType<typeof usePopupStyles>;
}) {
  const result = service.typosquatResult;

  if (!result?.isTyposquat) return null;

  const getBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      default:
        return "info";
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
      default:
        return "?";
    }
  };

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <code style={styles.code}>{service.domain}</code>
      </td>
      <td style={styles.tableCell}>
        <span>{result.totalScore}/100</span>
      </td>
      <td style={styles.tableCell}>
        <Badge variant={getBadgeVariant(result.confidence)}>
          {getConfidenceLabel(result.confidence)}
        </Badge>
      </td>
    </tr>
  );
}
