import type { CSPViolation } from "@ai-service-exposure/core";

interface Props {
  violations: CSPViolation[];
}

export function ViolationList({ violations }: Props) {
  if (violations.length === 0) {
    return <p style={styles.empty}>No CSP violations detected</p>;
  }

  return (
    <div style={styles.container}>
      {violations.map((v, i) => (
        <div key={i} style={styles.item}>
          <div style={styles.header}>
            <span style={styles.directive}>{v.directive}</span>
            <span style={styles.disposition}>{v.disposition}</span>
          </div>
          <div style={styles.url}>{truncateUrl(v.blockedURL)}</div>
          <div style={styles.meta}>
            <span>{v.domain}</span>
            <span>{formatTime(v.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + "...";
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch {
    return timestamp;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "8px",
  },
  empty: {
    textAlign: "center",
    padding: "40px 20px",
    color: "hsl(0 0% 50%)",
    fontSize: "13px",
  },
  item: {
    padding: "10px 12px",
    borderBottom: "1px solid hsl(0 0% 92%)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  directive: {
    fontSize: "12px",
    fontWeight: 600,
    color: "hsl(0 70% 50%)",
    fontFamily: "monospace",
  },
  disposition: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    background: "hsl(0 0% 95%)",
    color: "hsl(0 0% 45%)",
  },
  url: {
    fontSize: "12px",
    color: "hsl(0 0% 30%)",
    fontFamily: "monospace",
    wordBreak: "break-all",
    marginBottom: "4px",
  },
  meta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "hsl(0 0% 50%)",
  },
};
