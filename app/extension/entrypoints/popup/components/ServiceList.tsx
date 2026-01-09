import type { DetectedService } from "@service-policy-controller/core";
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

function ServiceRow({ service }: { service: DetectedService }) {
  const tags: string[] = [];
  if (service.hasLoginPage) tags.push("login");
  if (service.privacyPolicyUrl) tags.push("privacy");

  const url = sanitizeUrl(service.privacyPolicyUrl, service.domain);

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "hsl(0 0% 25%)", textDecoration: "none" }}
        >
          <span style={styles.code}>{service.domain}</span>
        </a>
      </td>
      <td style={styles.tableCell}>
        {tags.map((tag) => (
          <span key={tag} style={{ ...styles.badge, marginRight: "4px" }}>
            {tag}
          </span>
        ))}
      </td>
      <td style={{ ...styles.tableCell, textAlign: "right" }}>
        {service.cookies.length > 0 && (
          <span style={styles.badge}>{service.cookies.length}</span>
        )}
      </td>
    </tr>
  );
}
