import type { NetworkRequest } from "@ai-service-exposure/core";

interface Props {
  requests: NetworkRequest[];
}

export function NetworkList({ requests }: Props) {
  if (requests.length === 0) {
    return <p style={styles.empty}>No network requests captured</p>;
  }

  return (
    <div style={styles.container}>
      {requests.map((r, i) => (
        <div key={i} style={styles.item}>
          <div style={styles.header}>
            <span style={styles.method}>{r.method}</span>
            <span style={styles.initiator}>{r.initiator}</span>
          </div>
          <div style={styles.url}>{truncateUrl(r.url)}</div>
          <div style={styles.meta}>
            <span>{r.domain}</span>
            <span>{formatTime(r.timestamp)}</span>
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
  method: {
    fontSize: "11px",
    fontWeight: 600,
    color: "hsl(210 70% 45%)",
    fontFamily: "monospace",
  },
  initiator: {
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
