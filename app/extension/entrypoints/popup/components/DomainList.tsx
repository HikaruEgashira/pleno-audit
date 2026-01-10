import type { DetectedService } from "@service-policy-auditor/detectors";
import { Badge } from "../../../components";
import { usePopupStyles } from "../styles";
import type { ServiceProps } from "../types";

export function DomainList({ services }: ServiceProps) {
  const styles = usePopupStyles();

  // NRDまたはTyposquatが検出されたサービスのみフィルタ
  const alertServices = services.filter(
    (s) => s.nrdResult?.isNRD || s.typosquatResult?.isTyposquat
  );

  if (alertServices.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>不審なドメインは検出されていません</p>
      </div>
    );
  }

  const sorted = [...alertServices].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>不審ドメイン ({alertServices.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>ドメイン</th>
              <th style={styles.tableHeader}>検出</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((service) => (
              <DomainRow key={service.domain} service={service} styles={styles} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DomainRow({
  service,
  styles,
}: {
  service: DetectedService;
  styles: ReturnType<typeof usePopupStyles>;
}) {
  const { nrdResult, typosquatResult } = service;

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <code style={styles.code}>{service.domain}</code>
      </td>
      <td style={styles.tableCell}>
        {nrdResult?.isNRD && <NRDBadge nrdResult={nrdResult} />}
        {typosquatResult?.isTyposquat && <TyposquatBadge result={typosquatResult} />}
      </td>
    </tr>
  );
}

function NRDBadge({
  nrdResult,
}: {
  nrdResult: NonNullable<DetectedService["nrdResult"]>;
}) {
  const label =
    nrdResult.domainAge !== null ? `NRD (${nrdResult.domainAge}d)` : "NRD?";
  const title =
    nrdResult.confidence === "high"
      ? `新規登録ドメイン (${nrdResult.domainAge}日)`
      : "新規登録ドメインの可能性";

  return (
    <span style={{ marginRight: "4px" }} title={title}>
      <Badge variant="danger">{label}</Badge>
    </span>
  );
}

function TyposquatBadge({
  result,
}: {
  result: NonNullable<DetectedService["typosquatResult"]>;
}) {
  const getVariant = (confidence: string): "danger" | "warning" | "info" => {
    switch (confidence) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      default:
        return "info";
    }
  };

  const label = `typo (${result.totalScore})`;
  const detailsText = result.details
    .map((d) => `${d.type}: ${d.description}`)
    .join("\n");
  const title = `タイポスクワッティング疑い\nスコア: ${result.totalScore}\n${detailsText}`;

  return (
    <span style={{ marginRight: "4px" }} title={title}>
      <Badge variant={getVariant(result.confidence)}>{label}</Badge>
    </span>
  );
}
