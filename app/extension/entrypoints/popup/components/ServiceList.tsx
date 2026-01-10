import type { DetectedService } from "@service-policy-auditor/detectors";
import { Badge, Card } from "../../../components";
import { usePopupStyles } from "../styles";

interface Props {
  services: DetectedService[];
}

function sanitizeUrl(url: string | null, domain: string): string {
  if (!url) {
    return `https://${domain}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return `https://${domain}`;
    }
    return url;
  } catch {
    return `https://${domain}`;
  }
}

export function ServiceList({ services }: Props) {
  const styles = usePopupStyles();

  if (services.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>サービスはまだ検出されていません</p>
      </div>
    );
  }

  const sorted = [...services].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>検出サービス ({services.length})</h3>
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>ドメイン</th>
              <th style={styles.tableHeader}>タグ</th>
              <th style={styles.tableHeader}>Cookie</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((service) => (
              <ServiceRow key={service.domain} service={service} styles={styles} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TagBadge({ tag, url, variant = "default" }: { tag: string; url?: string | null; variant?: "default" | "warning" }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", marginRight: "4px" }}
      >
        <Badge variant={variant}>{tag}</Badge>
      </a>
    );
  }

  return (
    <span style={{ marginRight: "4px" }}>
      <Badge variant={variant}>{tag}</Badge>
    </span>
  );
}

function NRDBadge({
  nrdResult,
}: {
  nrdResult: DetectedService["nrdResult"];
}) {
  if (!nrdResult?.isNRD) return null;

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

function ServiceRow({ service, styles }: { service: DetectedService; styles: ReturnType<typeof usePopupStyles> }) {
  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <code style={styles.code}>{service.domain}</code>
      </td>
      <td style={styles.tableCell}>
        <NRDBadge nrdResult={service.nrdResult} />
        {service.hasLoginPage && <TagBadge tag="login" variant="warning" />}
        {service.privacyPolicyUrl && (
          <TagBadge
            tag="privacy"
            url={sanitizeUrl(service.privacyPolicyUrl, service.domain)}
          />
        )}
        {service.termsOfServiceUrl && (
          <TagBadge
            tag="tos"
            url={sanitizeUrl(service.termsOfServiceUrl, service.domain)}
          />
        )}
      </td>
      <td style={{ ...styles.tableCell, textAlign: "right" }}>
        {service.cookies.length > 0 && (
          <Badge>{service.cookies.length}</Badge>
        )}
      </td>
    </tr>
  );
}
