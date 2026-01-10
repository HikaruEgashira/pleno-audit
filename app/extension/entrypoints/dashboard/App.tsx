import { useState, useEffect, useCallback } from "preact/hooks";
import type {
  CSPViolation,
  NetworkRequest,
  CSPReport,
} from "@service-policy-auditor/core";
import { dashboardStyles } from "./styles";

interface Stats {
  violations: number;
  requests: number;
  uniqueDomains: number;
}

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={dashboardStyles.statCard}>
      <div style={dashboardStyles.statValue}>{value}</div>
      <div style={dashboardStyles.statLabel}>{label}</div>
    </div>
  );
}

function ViolationsTable({ violations }: { violations: CSPViolation[] }) {
  if (violations.length === 0) {
    return <p style={dashboardStyles.empty}>No CSP violations recorded</p>;
  }
  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>Time</th>
            <th style={dashboardStyles.th}>Page</th>
            <th style={dashboardStyles.th}>Directive</th>
            <th style={dashboardStyles.th}>Blocked URL</th>
          </tr>
        </thead>
        <tbody>
          {violations.slice(0, 50).map((v, i) => (
            <tr key={i} style={dashboardStyles.tr}>
              <td style={dashboardStyles.td}>
                {new Date(v.timestamp).toLocaleTimeString()}
              </td>
              <td style={dashboardStyles.tdUrl}>{truncate(v.pageUrl, 40)}</td>
              <td style={dashboardStyles.td}>
                <code style={dashboardStyles.code}>{v.directive}</code>
              </td>
              <td style={dashboardStyles.tdUrl}>
                {truncate(v.blockedURL, 40)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {violations.length > 50 && (
        <p style={dashboardStyles.more}>
          Showing latest 50 of {violations.length}
        </p>
      )}
    </div>
  );
}

function NetworkTable({ requests }: { requests: NetworkRequest[] }) {
  if (requests.length === 0) {
    return <p style={dashboardStyles.empty}>No network requests recorded</p>;
  }
  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>Time</th>
            <th style={dashboardStyles.th}>Type</th>
            <th style={dashboardStyles.th}>Method</th>
            <th style={dashboardStyles.th}>From</th>
            <th style={dashboardStyles.th}>Domain</th>
            <th style={dashboardStyles.th}>URL</th>
          </tr>
        </thead>
        <tbody>
          {requests.slice(0, 50).map((r, i) => (
            <tr key={i} style={dashboardStyles.tr}>
              <td style={dashboardStyles.td}>
                {new Date(r.timestamp).toLocaleTimeString()}
              </td>
              <td style={dashboardStyles.td}>
                <span style={dashboardStyles.badge}>{r.initiator}</span>
              </td>
              <td style={dashboardStyles.td}>
                <code style={dashboardStyles.code}>{r.method || "GET"}</code>
              </td>
              <td style={dashboardStyles.tdUrl} title={r.pageUrl}>
                {truncate(r.pageUrl, 30)}
              </td>
              <td style={dashboardStyles.td}>{r.domain}</td>
              <td style={dashboardStyles.tdUrl}>{truncate(r.url, 40)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {requests.length > 50 && (
        <p style={dashboardStyles.more}>
          Showing latest 50 of {requests.length}
        </p>
      )}
    </div>
  );
}

function StatsCard({
  title,
  data,
  isDirective,
}: {
  title: string;
  data: Record<string, number>;
  isDirective?: boolean;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <div style={dashboardStyles.card}>
        <h3 style={dashboardStyles.cardTitle}>{title}</h3>
        <p style={dashboardStyles.empty}>No data</p>
      </div>
    );
  }
  return (
    <div style={dashboardStyles.card}>
      <h3 style={dashboardStyles.cardTitle}>{title}</h3>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>{title.replace("By ", "")}</th>
            <th style={dashboardStyles.th}>Count</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, count]) => (
            <tr key={key} style={dashboardStyles.tr}>
              <td style={dashboardStyles.td}>
                {isDirective ? (
                  <code style={dashboardStyles.code}>{key}</code>
                ) : (
                  <span style={dashboardStyles.badge}>{key}</span>
                )}
              </td>
              <td style={dashboardStyles.td}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardApp() {
  const [reports, setReports] = useState<CSPReport[]>([]);
  const [stats, setStats] = useState<Stats>({
    violations: 0,
    requests: 0,
    uniqueDomains: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState<"local" | "remote">(
    "local"
  );

  const loadData = useCallback(async () => {
    try {
      const [reportsResult, statsResult, configResult] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_CSP_REPORTS" }),
        chrome.runtime.sendMessage({ type: "GET_STATS" }),
        chrome.runtime.sendMessage({ type: "GET_CONNECTION_CONFIG" }),
      ]);

      if (Array.isArray(reportsResult)) {
        setReports(reportsResult);
      }
      if (statsResult) {
        setStats(statsResult);
      }
      if (configResult) {
        setConnectionMode(configResult.mode);
      }
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleClearData = async () => {
    if (!confirm("Clear all collected data?")) return;
    try {
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      await loadData();
    } catch (error) {
      console.error("Failed to clear data:", error);
    }
  };

  const handleExportData = () => {
    const blob = new Blob([JSON.stringify({ reports, stats }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-exposure-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const violations = reports.filter(
    (r) => r.type === "csp-violation"
  ) as CSPViolation[];
  const networkRequests = reports.filter(
    (r) => r.type === "network-request"
  ) as NetworkRequest[];

  const directiveStats: Record<string, number> = {};
  for (const v of violations) {
    const d = v.directive || "unknown";
    directiveStats[d] = (directiveStats[d] ?? 0) + 1;
  }

  const initiatorStats: Record<string, number> = {};
  for (const r of networkRequests) {
    const i = r.initiator || "unknown";
    initiatorStats[i] = (initiatorStats[i] ?? 0) + 1;
  }

  if (loading) {
    return (
      <div style={dashboardStyles.container}>
        <p style={dashboardStyles.loading}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={dashboardStyles.container}>
      <header style={dashboardStyles.header}>
        <h1 style={dashboardStyles.title}>Service Policy Auditor Dashboard</h1>
        <p style={dashboardStyles.subtitle}>
          Last updated: {new Date(lastUpdated).toLocaleString()} | Mode:{" "}
          {connectionMode}
        </p>
      </header>

      <div style={dashboardStyles.statsGrid}>
        <StatCard value={reports.length} label="Total Events" />
        <StatCard value={violations.length} label="CSP Violations" />
        <StatCard value={networkRequests.length} label="Network Requests" />
        <StatCard value={stats.uniqueDomains} label="Unique Domains" />
      </div>

      <div style={dashboardStyles.actions}>
        <button style={dashboardStyles.btn} onClick={() => loadData()}>
          Refresh
        </button>
        <button style={dashboardStyles.btnSecondary} onClick={handleClearData}>
          Clear All Data
        </button>
        <button
          style={dashboardStyles.btnSecondary}
          onClick={handleExportData}
        >
          Export JSON
        </button>
        <span style={dashboardStyles.refreshNote}>
          Auto-refreshes every 5 seconds
        </span>
      </div>

      <section style={dashboardStyles.section}>
        <h2 style={dashboardStyles.sectionTitle}>CSP Violations</h2>
        <ViolationsTable violations={violations} />
      </section>

      <section style={dashboardStyles.section}>
        <h2 style={dashboardStyles.sectionTitle}>Network Requests</h2>
        <NetworkTable requests={networkRequests} />
      </section>

      <section style={dashboardStyles.section}>
        <h2 style={dashboardStyles.sectionTitle}>Statistics</h2>
        <div style={dashboardStyles.statsColumns}>
          <StatsCard title="By Directive" data={directiveStats} isDirective />
          <StatsCard title="By Initiator" data={initiatorStats} />
        </div>
      </section>
    </div>
  );
}
