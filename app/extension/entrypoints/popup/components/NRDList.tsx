import type { DetectedService } from "@service-policy-auditor/detectors";
import { styles } from "../styles";

interface Props {
  services: DetectedService[];
}

export function NRDList({ services }: Props) {
  const nrdServices = services.filter((s) => s.nrdResult?.isNRD);

  if (nrdServices.length === 0) {
    return (
      <div style={styles.section}>
        <p style={styles.emptyText}>No newly registered domains detected</p>
      </div>
    );
  }

  const sorted = [...nrdServices].sort((a, b) => b.detectedAt - a.detectedAt);

  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>Newly Registered Domains ({nrdServices.length})</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Domain</th>
            <th style={styles.tableHeader}>Age (days)</th>
            <th style={styles.tableHeader}>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((service) => (
            <NRDRow key={service.domain} service={service} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NRDRow({ service }: { service: DetectedService }) {
  const nrdResult = service.nrdResult;

  if (!nrdResult?.isNRD) return null;

  const confidenceColor =
    nrdResult.confidence === "high"
      ? "hsl(0 70% 60%)" // Red
      : "hsl(40 70% 50%)"; // Orange

  const confidenceLabel =
    nrdResult.confidence === "high" ? "High" : "Medium";

  return (
    <tr style={styles.tableRow}>
      <td style={styles.tableCell}>
        <span style={styles.code}>{service.domain}</span>
      </td>
      <td style={styles.tableCell}>
        <span>{nrdResult.domainAge !== null ? nrdResult.domainAge : "?"}</span>
      </td>
      <td style={styles.tableCell}>
        <span
          style={{
            ...styles.badge,
            backgroundColor: confidenceColor,
            color: "white",
            fontWeight: "bold",
          }}
        >
          {confidenceLabel}
        </span>
      </td>
    </tr>
  );
}
