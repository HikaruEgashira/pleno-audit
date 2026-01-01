import type { DetectedService } from "@ai-service-exposure/core";

interface Props {
  services: DetectedService[];
}

export function ServiceList({ services }: Props) {
  if (services.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyTitle}>No services detected</p>
        <p style={styles.emptyHint}>
          Browse the web to detect login pages and privacy policies.
        </p>
      </div>
    );
  }

  const sorted = [...services].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.list}>
      {sorted.map((service) => (
        <ServiceCard key={service.domain} service={service} />
      ))}
    </div>
  );
}

function ServiceCard({ service }: { service: DetectedService }) {
  const date = new Date(service.detectedAt).toLocaleDateString();

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.domain}>{service.domain}</span>
        <span style={styles.date}>{date}</span>
      </div>

      <div style={styles.badges}>
        {service.hasLoginPage && <span style={styles.badge}>Login</span>}
        {service.privacyPolicyUrl && <span style={styles.badge}>Privacy</span>}
        {service.cookies.length > 0 && (
          <span style={styles.badge}>{service.cookies.length} cookies</span>
        )}
      </div>

      {service.privacyPolicyUrl && (
        <a
          href={service.privacyPolicyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          View Privacy Policy →
        </a>
      )}

      {service.cookies.length > 0 && (
        <div style={styles.cookieList}>
          {service.cookies.slice(0, 3).map((c) => (
            <code key={c.name} style={styles.cookieName}>
              {c.name}
            </code>
          ))}
          {service.cookies.length > 3 && (
            <span style={styles.cookieMore}>+{service.cookies.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  empty: {
    textAlign: "center",
    padding: "48px 20px",
  },
  emptyTitle: {
    fontSize: "14px",
    fontWeight: 500,
    color: "hsl(0 0% 9%)",
  },
  emptyHint: {
    fontSize: "13px",
    marginTop: "4px",
    color: "hsl(0 0% 45%)",
  },
  card: {
    background: "hsl(0 0% 100%)",
    borderRadius: "8px",
    padding: "12px 14px",
    border: "1px solid hsl(0 0% 90%)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  domain: {
    fontWeight: 500,
    fontSize: "14px",
    color: "hsl(0 0% 9%)",
  },
  date: {
    fontSize: "12px",
    color: "hsl(0 0% 45%)",
  },
  badges: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginBottom: "10px",
  },
  badge: {
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "6px",
    fontWeight: 500,
    background: "hsl(0 0% 96%)",
    color: "hsl(0 0% 32%)",
    border: "1px solid hsl(0 0% 90%)",
  },
  link: {
    fontSize: "13px",
    color: "hsl(0 0% 32%)",
    textDecoration: "none",
    display: "block",
    marginBottom: "8px",
  },
  cookieList: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid hsl(0 0% 94%)",
  },
  cookieName: {
    fontSize: "11px",
    background: "hsl(0 0% 96%)",
    padding: "3px 6px",
    borderRadius: "4px",
    fontFamily: "ui-monospace, monospace",
    color: "hsl(0 0% 32%)",
  },
  cookieMore: {
    fontSize: "11px",
    color: "hsl(0 0% 45%)",
    padding: "3px 0",
  },
};
