import type { DetectedService } from "@ai-service-exposure/core";

interface Props {
  services: DetectedService[];
}

export function ServiceList({ services }: Props) {
  if (services.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No services detected yet</p>
      </div>
    );
  }

  const sorted = [...services].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.list}>
      {sorted.map((service) => (
        <ServiceRow key={service.domain} service={service} />
      ))}
    </div>
  );
}

function ServiceRow({ service }: { service: DetectedService }) {
  const tags: string[] = [];
  if (service.hasLoginPage) tags.push("login");
  if (service.privacyPolicyUrl) tags.push("privacy");
  if (service.cookies.length > 0) tags.push(`${service.cookies.length} cookies`);

  return (
    <a
      href={service.privacyPolicyUrl || `https://${service.domain}`}
      target="_blank"
      rel="noopener noreferrer"
      style={styles.row}
    >
      <span style={styles.domain}>{service.domain}</span>
      <span style={styles.tags}>{tags.join(" · ")}</span>
    </a>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: "flex",
    flexDirection: "column",
    padding: "8px 0",
  },
  empty: {
    padding: "60px 20px",
    textAlign: "center",
    fontSize: "13px",
    color: "hsl(0 0% 50%)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    textDecoration: "none",
    color: "inherit",
  },
  domain: {
    fontSize: "14px",
    fontWeight: 500,
    color: "hsl(0 0% 15%)",
  },
  tags: {
    fontSize: "12px",
    color: "hsl(0 0% 55%)",
  },
};
