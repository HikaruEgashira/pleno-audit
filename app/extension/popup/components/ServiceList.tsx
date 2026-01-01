import type { DetectedService } from "@ai-service-exposure/core";

interface Props {
  services: DetectedService[];
}

export function ServiceList({ services }: Props) {
  if (services.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No services detected yet.</p>
        <p style={styles.hint}>Browse the web to detect login pages and privacy policies.</p>
      </div>
    );
  }

  // Sort by detection time, newest first
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
        {service.hasLoginPage && (
          <span style={{ ...styles.badge, ...styles.badgeLogin }}>Login</span>
        )}
        {service.privacyPolicyUrl && (
          <span style={{ ...styles.badge, ...styles.badgePrivacy }}>Privacy Policy</span>
        )}
        {service.cookies.length > 0 && (
          <span style={{ ...styles.badge, ...styles.badgeCookie }}>
            {service.cookies.length} Cookies
          </span>
        )}
      </div>

      {service.privacyPolicyUrl && (
        <a
          href={service.privacyPolicyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          View Privacy Policy
        </a>
      )}

      {service.cookies.length > 0 && (
        <div style={styles.cookieList}>
          {service.cookies.slice(0, 3).map((c) => (
            <span key={c.name} style={styles.cookieName}>
              {c.name}
            </span>
          ))}
          {service.cookies.length > 3 && (
            <span style={styles.cookieMore}>+{service.cookies.length - 3} more</span>
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
    padding: "40px 20px",
    color: "#666",
  },
  hint: {
    fontSize: "12px",
    marginTop: "8px",
    color: "#999",
  },
  card: {
    background: "white",
    borderRadius: "8px",
    padding: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  domain: {
    fontWeight: 600,
    fontSize: "14px",
  },
  date: {
    fontSize: "11px",
    color: "#999",
  },
  badges: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  badge: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: 500,
  },
  badgeLogin: {
    background: "#e3f2fd",
    color: "#1976d2",
  },
  badgePrivacy: {
    background: "#e8f5e9",
    color: "#388e3c",
  },
  badgeCookie: {
    background: "#fff3e0",
    color: "#f57c00",
  },
  link: {
    fontSize: "12px",
    color: "#4a90d9",
    textDecoration: "none",
  },
  cookieList: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
    marginTop: "8px",
  },
  cookieName: {
    fontSize: "10px",
    background: "#f5f5f5",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "monospace",
  },
  cookieMore: {
    fontSize: "10px",
    color: "#999",
  },
};
