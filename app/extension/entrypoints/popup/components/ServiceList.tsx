import type { DetectedService } from "@service-policy-auditor/core";
import { styles } from "../styles";

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
  if (services.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No services detected yet</p>
      </div>
    );
  }

  const sorted = [...services].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Detected Services ({services.length})</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Domain</th>
            <th style={styles.tableHeader}>Tags</th>
            <th style={styles.tableHeader}>Cookies</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((service) => (
            <ServiceRow key={service.domain} service={service} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TagBadge({ tag, url }: { tag: string; url?: string | null }) {
  const badgeStyle = { ...styles.badge, marginRight: "4px" };

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
      >
        <span style={{ ...badgeStyle, cursor: "pointer" }}>{tag}</span>
      </a>
    );
  }

  return <span style={badgeStyle}>{tag}</span>;
}

function ServiceRow({ service }: { service: DetectedService }) {
  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <span style={styles.code}>{service.domain}</span>
      </td>
      <td style={styles.tableCell}>
        {service.hasLoginPage && <TagBadge tag="login" />}
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
          <span style={styles.badge}>{service.cookies.length}</span>
        )}
      </td>
    </tr>
  );
}
