import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import type {
  CSPViolation,
  NetworkRequest,
  CSPReport,
} from "@service-policy-auditor/csp";
import type {
  CapturedAIPrompt,
  DetectedService,
  EventLog,
} from "@service-policy-auditor/detectors";
import { dashboardStyles } from "./styles";

interface Stats {
  violations: number;
  requests: number;
  uniqueDomains: number;
}

type Period = "1h" | "24h" | "7d" | "30d" | "all";
type TabType = "overview" | "violations" | "network" | "domains" | "ai" | "services" | "events";

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

function getPeriodMs(period: Period): number {
  switch (period) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const periods: Period[] = ["1h", "24h", "7d", "30d", "all"];
  const labels: Record<Period, string> = {
    "1h": "1時間",
    "24h": "24時間",
    "7d": "7日",
    "30d": "30日",
    all: "全期間",
  };
  return (
    <div style={dashboardStyles.periodSelector}>
      {periods.map((p) => (
        <button
          key={p}
          style={
            period === p
              ? dashboardStyles.periodBtnActive
              : dashboardStyles.periodBtn
          }
          onClick={() => onChange(p)}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  value,
  label,
  trend,
}: {
  value: number;
  label: string;
  trend?: { value: number; isUp: boolean };
}) {
  return (
    <div style={dashboardStyles.statCard}>
      <div style={dashboardStyles.statValue}>{value.toLocaleString()}</div>
      <div style={dashboardStyles.statLabel}>{label}</div>
      {trend && trend.value > 0 && (
        <div
          style={{
            ...dashboardStyles.statTrend,
            ...(trend.isUp
              ? dashboardStyles.statTrendUp
              : dashboardStyles.statTrendDown),
          }}
        >
          {trend.isUp ? "↑" : "↓"} {trend.value} (前期間比)
        </div>
      )}
    </div>
  );
}

function AlertSummary({
  violations,
  topDomains,
  nrdCount,
  aiPromptCount,
  loginCount,
}: {
  violations: CSPViolation[];
  topDomains: { domain: string; count: number }[];
  nrdCount: number;
  aiPromptCount: number;
  loginCount: number;
}) {
  const recentViolations = violations.filter(
    (v) => Date.now() - v.timestamp < 60 * 60 * 1000
  );
  const criticalDirectives = ["script-src", "default-src", "connect-src"];
  const criticalViolations = violations.filter((v) =>
    criticalDirectives.includes(v.directive)
  );

  const hasAlerts =
    recentViolations.length > 0 ||
    criticalViolations.length > 0 ||
    nrdCount > 0 ||
    aiPromptCount > 0;

  if (!hasAlerts) {
    return null;
  }

  const alertStyle =
    nrdCount > 0 || criticalViolations.length > 10
      ? dashboardStyles.alertCardDanger
      : recentViolations.length > 5
        ? dashboardStyles.alertCardWarning
        : dashboardStyles.alertCard;

  return (
    <div style={dashboardStyles.alertSection}>
      <div style={alertStyle}>
        <div style={dashboardStyles.alertTitle}>運用サマリー</div>
        <ul style={dashboardStyles.alertList}>
          {nrdCount > 0 && (
            <li style={{ fontWeight: 600 }}>
              新規登録ドメイン(NRD)検出: {nrdCount} 件 - 要確認
            </li>
          )}
          {recentViolations.length > 0 && (
            <li>直近1時間で {recentViolations.length} 件のCSP違反を検出</li>
          )}
          {criticalViolations.length > 0 && (
            <li>
              重要ディレクティブ違反: {criticalViolations.length} 件
              (script-src, default-src, connect-src)
            </li>
          )}
          {topDomains.length > 0 && (
            <li>
              最多違反ドメイン: {topDomains[0].domain} ({topDomains[0].count}件)
            </li>
          )}
          {aiPromptCount > 0 && (
            <li>AIプロンプト送信: {aiPromptCount} 件 - データ流出リスク監視中</li>
          )}
          {loginCount > 0 && (
            <li>ログインページ検出: {loginCount} 件のサービス</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function HorizontalBarChart({
  data,
  title,
}: {
  data: { label: string; value: number }[];
  title: string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const displayData = data.slice(0, 8);

  return (
    <div style={dashboardStyles.card}>
      <h3 style={dashboardStyles.cardTitle}>{title}</h3>
      {displayData.length === 0 ? (
        <p style={dashboardStyles.empty}>データなし</p>
      ) : (
        <div style={dashboardStyles.chartContainer}>
          {displayData.map((item, i) => (
            <div key={i} style={dashboardStyles.chartBar}>
              <span style={dashboardStyles.chartLabel} title={item.label}>
                {truncate(item.label, 15)}
              </span>
              <div
                style={{
                  ...dashboardStyles.chartBarInner,
                  width: `${(item.value / maxValue) * 100}%`,
                  maxWidth: "calc(100% - 160px)",
                }}
              />
              <span style={dashboardStyles.chartValue}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  searchQuery,
  onSearchChange,
  directiveFilter,
  onDirectiveChange,
  directives,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  directiveFilter: string;
  onDirectiveChange: (d: string) => void;
  directives: string[];
}) {
  return (
    <div style={dashboardStyles.filterBar}>
      <div style={dashboardStyles.filterGroup}>
        <label style={dashboardStyles.filterLabel}>検索:</label>
        <input
          type="text"
          style={dashboardStyles.filterInput}
          placeholder="URL、ドメインで検索..."
          value={searchQuery}
          onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
        />
      </div>
      <div style={dashboardStyles.filterGroup}>
        <label style={dashboardStyles.filterLabel}>Directive:</label>
        <select
          style={dashboardStyles.filterSelect}
          value={directiveFilter}
          onChange={(e) =>
            onDirectiveChange((e.target as HTMLSelectElement).value)
          }
        >
          <option value="">すべて</option>
          {directives.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ViolationsTable({
  violations,
  searchQuery,
  directiveFilter,
}: {
  violations: CSPViolation[];
  searchQuery: string;
  directiveFilter: string;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    return violations.filter((v) => {
      if (directiveFilter && v.directive !== directiveFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          v.pageUrl.toLowerCase().includes(q) ||
          v.blockedURL.toLowerCase().includes(q) ||
          v.directive.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [violations, searchQuery, directiveFilter]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (filtered.length === 0) {
    return <p style={dashboardStyles.empty}>CSP違反は記録されていません</p>;
  }

  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>日時</th>
            <th style={dashboardStyles.th}>ページ</th>
            <th style={dashboardStyles.th}>Directive</th>
            <th style={dashboardStyles.th}>ブロックURL</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((v, i) => {
            const isCritical = ["script-src", "default-src"].includes(
              v.directive
            );
            return (
              <tr
                key={i}
                style={isCritical ? dashboardStyles.trHighlight : dashboardStyles.tr}
              >
                <td style={dashboardStyles.td}>
                  {new Date(v.timestamp).toLocaleString("ja-JP")}
                </td>
                <td style={dashboardStyles.tdUrl} title={v.pageUrl}>
                  {truncate(v.pageUrl, 40)}
                </td>
                <td style={dashboardStyles.td}>
                  <code
                    style={
                      isCritical ? dashboardStyles.badgeDanger : dashboardStyles.code
                    }
                  >
                    {v.directive}
                  </code>
                </td>
                <td style={dashboardStyles.tdUrl} title={v.blockedURL}>
                  {truncate(v.blockedURL, 40)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={dashboardStyles.pagination}>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            前へ
          </button>
          <span style={dashboardStyles.pageInfo}>
            {page + 1} / {totalPages} (全{filtered.length}件)
          </span>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}

function NetworkTable({
  requests,
  searchQuery,
}: {
  requests: NetworkRequest[];
  searchQuery: string;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.url.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        r.pageUrl.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (filtered.length === 0) {
    return (
      <p style={dashboardStyles.empty}>ネットワークリクエストは記録されていません</p>
    );
  }

  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>日時</th>
            <th style={dashboardStyles.th}>Type</th>
            <th style={dashboardStyles.th}>Method</th>
            <th style={dashboardStyles.th}>発信元</th>
            <th style={dashboardStyles.th}>ドメイン</th>
            <th style={dashboardStyles.th}>URL</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((r, i) => (
            <tr key={i} style={dashboardStyles.tr}>
              <td style={dashboardStyles.td}>
                {new Date(r.timestamp).toLocaleString("ja-JP")}
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
              <td style={dashboardStyles.tdUrl} title={r.url}>
                {truncate(r.url, 40)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={dashboardStyles.pagination}>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            前へ
          </button>
          <span style={dashboardStyles.pageInfo}>
            {page + 1} / {totalPages} (全{filtered.length}件)
          </span>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}

function DomainSummary({
  violations,
  requests,
}: {
  violations: CSPViolation[];
  requests: NetworkRequest[];
}) {
  const domainStats = useMemo(() => {
    const stats: Record<
      string,
      { violations: number; requests: number; lastSeen: number }
    > = {};

    for (const v of violations) {
      try {
        const url = new URL(v.blockedURL);
        const domain = url.hostname;
        if (!stats[domain]) {
          stats[domain] = { violations: 0, requests: 0, lastSeen: 0 };
        }
        stats[domain].violations++;
        stats[domain].lastSeen = Math.max(stats[domain].lastSeen, v.timestamp);
      } catch {
        // invalid URL
      }
    }

    for (const r of requests) {
      const domain = r.domain;
      if (!stats[domain]) {
        stats[domain] = { violations: 0, requests: 0, lastSeen: 0 };
      }
      stats[domain].requests++;
      stats[domain].lastSeen = Math.max(stats[domain].lastSeen, r.timestamp);
    }

    return Object.entries(stats)
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.violations + b.requests - (a.violations + a.requests))
      .slice(0, 20);
  }, [violations, requests]);

  if (domainStats.length === 0) {
    return <p style={dashboardStyles.empty}>ドメインデータなし</p>;
  }

  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>ドメイン</th>
            <th style={dashboardStyles.th}>違反数</th>
            <th style={dashboardStyles.th}>リクエスト数</th>
            <th style={dashboardStyles.th}>最終検出</th>
          </tr>
        </thead>
        <tbody>
          {domainStats.map((d) => (
            <tr
              key={d.domain}
              style={
                d.violations > 0
                  ? dashboardStyles.trHighlight
                  : dashboardStyles.tr
              }
            >
              <td style={dashboardStyles.td}>
                <code style={dashboardStyles.code}>{d.domain}</code>
              </td>
              <td style={dashboardStyles.td}>
                {d.violations > 0 ? (
                  <span style={dashboardStyles.badgeDanger}>{d.violations}</span>
                ) : (
                  "-"
                )}
              </td>
              <td style={dashboardStyles.td}>{d.requests}</td>
              <td style={dashboardStyles.td}>
                {new Date(d.lastSeen).toLocaleString("ja-JP")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// AIプロンプト監視テーブル
function AIPromptsTable({
  prompts,
  searchQuery,
}: {
  prompts: CapturedAIPrompt[];
  searchQuery: string;
}) {
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 30;

  const filtered = useMemo(() => {
    if (!searchQuery) return prompts;
    const q = searchQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.provider?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.apiEndpoint.toLowerCase().includes(q) ||
        p.prompt.text?.toLowerCase().includes(q) ||
        p.prompt.messages?.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [prompts, searchQuery]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (filtered.length === 0) {
    return <p style={dashboardStyles.empty}>AIプロンプトは記録されていません</p>;
  }

  const getPromptPreview = (p: CapturedAIPrompt): string => {
    if (p.prompt.messages?.length) {
      const last = [...p.prompt.messages].reverse().find((m) => m.role === "user");
      return last?.content.substring(0, 80) || "";
    }
    return p.prompt.text?.substring(0, 80) || "";
  };

  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>日時</th>
            <th style={dashboardStyles.th}>Provider</th>
            <th style={dashboardStyles.th}>Model</th>
            <th style={dashboardStyles.th}>プロンプト</th>
            <th style={dashboardStyles.th}>レスポンス</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((p) => (
            <>
              <tr
                key={p.id}
                style={{
                  ...dashboardStyles.tr,
                  cursor: "pointer",
                }}
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                <td style={dashboardStyles.td}>
                  {new Date(p.timestamp).toLocaleString("ja-JP")}
                </td>
                <td style={dashboardStyles.td}>
                  <span style={dashboardStyles.badge}>{p.provider || "unknown"}</span>
                </td>
                <td style={dashboardStyles.td}>
                  <code style={dashboardStyles.code}>{p.model || "-"}</code>
                </td>
                <td style={dashboardStyles.tdUrl}>
                  {truncate(getPromptPreview(p), 50)}
                </td>
                <td style={dashboardStyles.td}>
                  {p.response ? (
                    <span style={dashboardStyles.badge}>
                      {p.response.latencyMs}ms
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
              {expandedId === p.id && (
                <tr key={`${p.id}-detail`}>
                  <td colSpan={5} style={{ padding: "12px", background: "hsl(0 0% 98%)" }}>
                    <div style={{ marginBottom: "8px" }}>
                      <strong>Endpoint:</strong>{" "}
                      <code style={dashboardStyles.code}>{p.apiEndpoint}</code>
                    </div>
                    <div style={{ marginBottom: "8px" }}>
                      <strong>Prompt:</strong>
                      <pre
                        style={{
                          background: "hsl(0 0% 95%)",
                          padding: "8px",
                          borderRadius: "4px",
                          whiteSpace: "pre-wrap",
                          maxHeight: "150px",
                          overflow: "auto",
                          fontSize: "11px",
                          fontFamily: "'Menlo', monospace",
                          margin: "4px 0 0",
                        }}
                      >
                        {p.prompt.messages
                          ? p.prompt.messages.map((m) => `[${m.role}] ${m.content}`).join("\n\n")
                          : p.prompt.text || ""}
                      </pre>
                    </div>
                    {p.response && (
                      <div>
                        <strong>Response:</strong>
                        <pre
                          style={{
                            background: "hsl(0 0% 95%)",
                            padding: "8px",
                            borderRadius: "4px",
                            whiteSpace: "pre-wrap",
                            maxHeight: "150px",
                            overflow: "auto",
                            fontSize: "11px",
                            fontFamily: "'Menlo', monospace",
                            margin: "4px 0 0",
                          }}
                        >
                          {p.response.text || "(No text)"}
                        </pre>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={dashboardStyles.pagination}>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            前へ
          </button>
          <span style={dashboardStyles.pageInfo}>
            {page + 1} / {totalPages} (全{filtered.length}件)
          </span>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}

// 検出サービス一覧
function ServicesTable({
  services,
  searchQuery,
}: {
  services: DetectedService[];
  searchQuery: string;
}) {
  const filtered = useMemo(() => {
    if (!searchQuery) return services;
    const q = searchQuery.toLowerCase();

    // 特殊フィルタ
    if (q === "nrd") {
      return services.filter((s) => s.nrdResult?.isNRD);
    }
    if (q === "login") {
      return services.filter((s) => s.hasLoginPage);
    }

    return services.filter(
      (s) =>
        s.domain.toLowerCase().includes(q) ||
        s.privacyPolicyUrl?.toLowerCase().includes(q) ||
        s.termsOfServiceUrl?.toLowerCase().includes(q)
    );
  }, [services, searchQuery]);

  if (filtered.length === 0) {
    return <p style={dashboardStyles.empty}>検出されたサービスはありません</p>;
  }

  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>ドメイン</th>
            <th style={dashboardStyles.th}>ログイン</th>
            <th style={dashboardStyles.th}>プライバシーポリシー</th>
            <th style={dashboardStyles.th}>利用規約</th>
            <th style={dashboardStyles.th}>NRD</th>
            <th style={dashboardStyles.th}>Cookie数</th>
            <th style={dashboardStyles.th}>検出日時</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr
              key={s.domain}
              style={s.nrdResult?.isNRD ? dashboardStyles.trHighlight : dashboardStyles.tr}
            >
              <td style={dashboardStyles.td}>
                <code style={dashboardStyles.code}>{s.domain}</code>
              </td>
              <td style={dashboardStyles.td}>
                {s.hasLoginPage ? (
                  <span style={dashboardStyles.badgeWarning}>検出</span>
                ) : (
                  "-"
                )}
              </td>
              <td style={dashboardStyles.tdUrl}>
                {s.privacyPolicyUrl ? (
                  <a
                    href={s.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "hsl(210 100% 40%)", fontSize: "12px" }}
                  >
                    {truncate(s.privacyPolicyUrl, 30)}
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td style={dashboardStyles.tdUrl}>
                {s.termsOfServiceUrl ? (
                  <a
                    href={s.termsOfServiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "hsl(210 100% 40%)", fontSize: "12px" }}
                  >
                    {truncate(s.termsOfServiceUrl, 30)}
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td style={dashboardStyles.td}>
                {s.nrdResult?.isNRD ? (
                  <span style={dashboardStyles.badgeDanger}>
                    NRD ({s.nrdResult.confidence})
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td style={dashboardStyles.td}>{s.cookies.length}</td>
              <td style={dashboardStyles.td}>
                {new Date(s.detectedAt).toLocaleString("ja-JP")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// イベントログ一覧
function EventLogTable({
  events,
  searchQuery,
}: {
  events: EventLog[];
  searchQuery: string;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.type.toLowerCase().includes(q) ||
        e.domain.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (filtered.length === 0) {
    return <p style={dashboardStyles.empty}>イベントは記録されていません</p>;
  }

  const getEventBadgeStyle = (type: string) => {
    if (type.includes("violation") || type.includes("nrd")) {
      return dashboardStyles.badgeDanger;
    }
    if (type.includes("login") || type.includes("ai")) {
      return dashboardStyles.badgeWarning;
    }
    return dashboardStyles.badge;
  };

  const formatEventDetails = (e: EventLog): string => {
    const details = e.details as Record<string, unknown>;
    if (!details) return "-";

    switch (e.type) {
      case "login_detected":
        return details.isLoginUrl ? "URL検出" : "パスワード入力検出";
      case "privacy_policy_found":
      case "terms_of_service_found":
        return truncate(String(details.url || ""), 40);
      case "csp_violation":
        return `${details.directive}: ${truncate(String(details.blockedURL || ""), 30)}`;
      case "ai_prompt_sent":
        return `${details.provider}/${details.model}`;
      case "nrd_detected":
        return `信頼度: ${details.confidence}, 経過日数: ${details.domainAge}日`;
      default:
        return JSON.stringify(details).substring(0, 50);
    }
  };

  return (
    <div style={dashboardStyles.card}>
      <table style={dashboardStyles.table}>
        <thead>
          <tr>
            <th style={dashboardStyles.th}>日時</th>
            <th style={dashboardStyles.th}>タイプ</th>
            <th style={dashboardStyles.th}>ドメイン</th>
            <th style={dashboardStyles.th}>詳細</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((e) => (
            <tr key={e.id} style={dashboardStyles.tr}>
              <td style={dashboardStyles.td}>
                {new Date(e.timestamp).toLocaleString("ja-JP")}
              </td>
              <td style={dashboardStyles.td}>
                <span style={getEventBadgeStyle(e.type)}>{e.type}</span>
              </td>
              <td style={dashboardStyles.td}>
                <code style={dashboardStyles.code}>{e.domain}</code>
              </td>
              <td style={dashboardStyles.tdUrl}>{formatEventDetails(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={dashboardStyles.pagination}>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            前へ
          </button>
          <span style={dashboardStyles.pageInfo}>
            {page + 1} / {totalPages} (全{filtered.length}件)
          </span>
          <button
            style={dashboardStyles.btnSmall}
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            次へ
          </button>
        </div>
      )}
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
  const [period, setPeriod] = useState<Period>("24h");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [directiveFilter, setDirectiveFilter] = useState("");
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);
  const [services, setServices] = useState<DetectedService[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [reportsResult, statsResult, configResult, aiPromptsResult, storageResult] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_CSP_REPORTS" }),
        chrome.runtime.sendMessage({ type: "GET_STATS" }),
        chrome.runtime.sendMessage({ type: "GET_CONNECTION_CONFIG" }),
        chrome.runtime.sendMessage({ type: "GET_AI_PROMPTS" }),
        chrome.storage.local.get(["services", "events"]),
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
      if (Array.isArray(aiPromptsResult)) {
        setAIPrompts(aiPromptsResult);
      }
      if (storageResult.services) {
        setServices(Object.values(storageResult.services));
      }
      if (storageResult.events) {
        setEvents(storageResult.events);
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
    if (!confirm("すべてのデータを削除しますか？")) return;
    try {
      await chrome.runtime.sendMessage({ type: "CLEAR_CSP_DATA" });
      await loadData();
    } catch (error) {
      console.error("Failed to clear data:", error);
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ reports, stats }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const violations = reports.filter(
      (r) => r.type === "csp-violation"
    ) as CSPViolation[];
    const csvLines = [
      "timestamp,type,pageUrl,directive,blockedURL",
      ...violations.map(
        (v) =>
          `"${new Date(v.timestamp).toISOString()}","violation","${v.pageUrl}","${v.directive}","${v.blockedURL}"`
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-violations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredReports = useMemo(() => {
    const cutoff = Date.now() - getPeriodMs(period);
    return reports.filter((r) => r.timestamp >= cutoff);
  }, [reports, period]);

  const violations = useMemo(
    () =>
      filteredReports.filter((r) => r.type === "csp-violation") as CSPViolation[],
    [filteredReports]
  );

  const networkRequests = useMemo(
    () =>
      filteredReports.filter(
        (r) => r.type === "network-request"
      ) as NetworkRequest[],
    [filteredReports]
  );

  const directives = useMemo(() => {
    const set = new Set(violations.map((v) => v.directive));
    return Array.from(set).sort();
  }, [violations]);

  const directiveStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const v of violations) {
      const d = v.directive || "unknown";
      stats[d] = (stats[d] ?? 0) + 1;
    }
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [violations]);

  const domainStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const v of violations) {
      try {
        const url = new URL(v.blockedURL);
        const domain = url.hostname;
        stats[domain] = (stats[domain] ?? 0) + 1;
      } catch {
        // invalid URL
      }
    }
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [violations]);

  const topDomains = domainStats.slice(0, 5).map((d) => ({
    domain: d.label,
    count: d.value,
  }));

  if (loading) {
    return (
      <div style={dashboardStyles.container}>
        <p style={dashboardStyles.loading}>読み込み中...</p>
      </div>
    );
  }

  const nrdServices = services.filter((s) => s.nrdResult?.isNRD);
  const loginServices = services.filter((s) => s.hasLoginPage);

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: "overview", label: "概要" },
    { id: "violations", label: "CSP違反", count: violations.length },
    { id: "network", label: "ネットワーク", count: networkRequests.length },
    { id: "domains", label: "ドメイン分析" },
    { id: "ai", label: "AI監視", count: aiPrompts.length },
    { id: "services", label: "サービス", count: services.length },
    { id: "events", label: "イベント", count: events.length },
  ];

  return (
    <div style={dashboardStyles.container}>
      <header style={dashboardStyles.header}>
        <div style={dashboardStyles.headerLeft}>
          <h1 style={dashboardStyles.title}>CASB Dashboard</h1>
          <p style={dashboardStyles.subtitle}>
            Browser Security Monitor | 更新: {new Date(lastUpdated).toLocaleString("ja-JP")} |
            モード: {connectionMode}
          </p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </header>

      <AlertSummary
        violations={violations}
        topDomains={topDomains}
        nrdCount={nrdServices.length}
        aiPromptCount={aiPrompts.length}
        loginCount={loginServices.length}
      />

      <div style={dashboardStyles.statsGrid}>
        <StatCard value={filteredReports.length} label="総イベント数" />
        <StatCard value={violations.length} label="CSP違反" />
        <StatCard value={networkRequests.length} label="ネットワークリクエスト" />
        <StatCard value={services.length} label="検出サービス" />
        <StatCard value={aiPrompts.length} label="AIプロンプト" />
        <StatCard
          value={nrdServices.length}
          label="NRD検出"
          trend={nrdServices.length > 0 ? { value: nrdServices.length, isUp: true } : undefined}
        />
      </div>

      <div style={dashboardStyles.actions}>
        <button style={dashboardStyles.btn} onClick={() => loadData()}>
          更新
        </button>
        <button style={dashboardStyles.btnSecondary} onClick={handleClearData}>
          データ削除
        </button>
        <button style={dashboardStyles.btnSecondary} onClick={handleExportJSON}>
          JSON出力
        </button>
        <button style={dashboardStyles.btnSecondary} onClick={handleExportCSV}>
          CSV出力
        </button>
        <span style={dashboardStyles.refreshNote}>5秒ごとに自動更新</span>
      </div>

      <div style={dashboardStyles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={
              activeTab === tab.id
                ? dashboardStyles.tabActive
                : dashboardStyles.tab
            }
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                style={{
                  marginLeft: "6px",
                  fontSize: "10px",
                  background: "hsl(0 0% 85%)",
                  padding: "2px 6px",
                  borderRadius: "8px",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* クイックアクション */}
          <div style={dashboardStyles.section}>
            <h3 style={dashboardStyles.cardTitle}>クイックアクション</h3>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                style={dashboardStyles.btn}
                onClick={() => setActiveTab("violations")}
              >
                CSP違反を確認 ({violations.length})
              </button>
              {nrdServices.length > 0 && (
                <button
                  style={{
                    ...dashboardStyles.btn,
                    background: "hsl(0 70% 50%)",
                  }}
                  onClick={() => setActiveTab("services")}
                >
                  NRD検出あり ({nrdServices.length})
                </button>
              )}
              {aiPrompts.length > 0 && (
                <button
                  style={dashboardStyles.btnSecondary}
                  onClick={() => setActiveTab("ai")}
                >
                  AIプロンプト確認 ({aiPrompts.length})
                </button>
              )}
              <button
                style={dashboardStyles.btnSecondary}
                onClick={() => setActiveTab("services")}
              >
                サービス一覧 ({services.length})
              </button>
            </div>
          </div>

          {/* グラフ */}
          <div style={dashboardStyles.statsColumns}>
            <HorizontalBarChart data={directiveStats} title="Directive別違反数" />
            <HorizontalBarChart data={domainStats} title="ドメイン別違反数" />
          </div>

          {/* 最近のイベント */}
          <div style={dashboardStyles.section}>
            <div style={dashboardStyles.sectionHeader}>
              <h3 style={dashboardStyles.cardTitle}>最近のイベント</h3>
              <button
                style={dashboardStyles.btnSmall}
                onClick={() => setActiveTab("events")}
              >
                すべて表示
              </button>
            </div>
            <div style={dashboardStyles.card}>
              {events.slice(0, 10).length === 0 ? (
                <p style={dashboardStyles.empty}>イベントなし</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {events.slice(0, 10).map((e) => (
                    <div
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px",
                        background: "hsl(0 0% 98%)",
                        borderRadius: "4px",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "hsl(0 0% 50%)", minWidth: "70px" }}>
                        {new Date(e.timestamp).toLocaleTimeString("ja-JP")}
                      </span>
                      <span
                        style={
                          e.type.includes("violation") || e.type.includes("nrd")
                            ? dashboardStyles.badgeDanger
                            : e.type.includes("ai") || e.type.includes("login")
                              ? dashboardStyles.badgeWarning
                              : dashboardStyles.badge
                        }
                      >
                        {e.type}
                      </span>
                      <code style={{ ...dashboardStyles.code, flex: 1 }}>{e.domain}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === "violations" && (
        <section style={dashboardStyles.section}>
          <div style={dashboardStyles.sectionHeader}>
            <h2 style={dashboardStyles.sectionTitle}>CSP違反一覧</h2>
            <span style={dashboardStyles.sectionCount}>{violations.length}件</span>
          </div>
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            directiveFilter={directiveFilter}
            onDirectiveChange={setDirectiveFilter}
            directives={directives}
          />
          <ViolationsTable
            violations={violations}
            searchQuery={searchQuery}
            directiveFilter={directiveFilter}
          />
        </section>
      )}

      {activeTab === "network" && (
        <section style={dashboardStyles.section}>
          <div style={dashboardStyles.sectionHeader}>
            <h2 style={dashboardStyles.sectionTitle}>ネットワークリクエスト</h2>
            <span style={dashboardStyles.sectionCount}>
              {networkRequests.length}件
            </span>
          </div>
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            directiveFilter=""
            onDirectiveChange={() => {}}
            directives={[]}
          />
          <NetworkTable requests={networkRequests} searchQuery={searchQuery} />
        </section>
      )}

      {activeTab === "domains" && (
        <section style={dashboardStyles.section}>
          <div style={dashboardStyles.sectionHeader}>
            <h2 style={dashboardStyles.sectionTitle}>ドメイン分析</h2>
          </div>
          <DomainSummary violations={violations} requests={networkRequests} />
        </section>
      )}

      {activeTab === "ai" && (
        <section style={dashboardStyles.section}>
          <div style={dashboardStyles.sectionHeader}>
            <h2 style={dashboardStyles.sectionTitle}>AIプロンプト監視</h2>
            <span style={dashboardStyles.sectionCount}>{aiPrompts.length}件</span>
          </div>

          {/* AIプロバイダー統計 */}
          {aiPrompts.length > 0 && (
            <div style={{ ...dashboardStyles.statsColumns, marginBottom: "16px" }}>
              <div style={dashboardStyles.card}>
                <h4 style={dashboardStyles.cardTitle}>プロバイダー別</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {Object.entries(
                    aiPrompts.reduce((acc, p) => {
                      const provider = p.provider || "unknown";
                      acc[provider] = (acc[provider] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([provider, count]) => (
                      <div key={provider} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={dashboardStyles.badge}>{provider}</span>
                        <span style={{ fontSize: "12px" }}>{count}件</span>
                      </div>
                    ))}
                </div>
              </div>
              <div style={dashboardStyles.card}>
                <h4 style={dashboardStyles.cardTitle}>データ流出リスク</h4>
                <div style={{ fontSize: "13px", color: "hsl(0 0% 40%)" }}>
                  <p style={{ margin: "0 0 8px" }}>
                    総送信プロンプト: <strong>{aiPrompts.length}</strong>件
                  </p>
                  <p style={{ margin: "0 0 8px" }}>
                    総文字数: <strong>
                      {aiPrompts.reduce((sum, p) => sum + (p.prompt.contentSize || 0), 0).toLocaleString()}
                    </strong>文字
                  </p>
                  <p style={{ margin: 0, color: "hsl(45 100% 35%)" }}>
                    機密情報の送信に注意してください
                  </p>
                </div>
              </div>
            </div>
          )}

          <div style={dashboardStyles.filterBar}>
            <div style={dashboardStyles.filterGroup}>
              <label style={dashboardStyles.filterLabel}>検索:</label>
              <input
                type="text"
                style={dashboardStyles.filterInput}
                placeholder="Provider、Model、プロンプト内容で検索..."
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
          <AIPromptsTable prompts={aiPrompts} searchQuery={searchQuery} />
        </section>
      )}

      {activeTab === "services" && (
        <section style={dashboardStyles.section}>
          <div style={dashboardStyles.sectionHeader}>
            <h2 style={dashboardStyles.sectionTitle}>検出サービス一覧</h2>
            <span style={dashboardStyles.sectionCount}>
              {services.length}件 (NRD: {nrdServices.length}, ログイン: {loginServices.length})
            </span>
          </div>

          {/* サービス統計サマリー */}
          <div style={{ ...dashboardStyles.statsGrid, marginBottom: "16px" }}>
            <div style={dashboardStyles.statCard}>
              <div style={dashboardStyles.statValue}>{services.length}</div>
              <div style={dashboardStyles.statLabel}>検出サービス</div>
            </div>
            <div style={dashboardStyles.statCard}>
              <div style={{ ...dashboardStyles.statValue, color: "hsl(0 70% 50%)" }}>
                {nrdServices.length}
              </div>
              <div style={dashboardStyles.statLabel}>NRD検出</div>
            </div>
            <div style={dashboardStyles.statCard}>
              <div style={{ ...dashboardStyles.statValue, color: "hsl(45 100% 35%)" }}>
                {loginServices.length}
              </div>
              <div style={dashboardStyles.statLabel}>ログインページ</div>
            </div>
            <div style={dashboardStyles.statCard}>
              <div style={dashboardStyles.statValue}>
                {services.filter((s) => s.privacyPolicyUrl).length}
              </div>
              <div style={dashboardStyles.statLabel}>プライバシーポリシー</div>
            </div>
          </div>

          <div style={dashboardStyles.filterBar}>
            <div style={dashboardStyles.filterGroup}>
              <label style={dashboardStyles.filterLabel}>検索:</label>
              <input
                type="text"
                style={dashboardStyles.filterInput}
                placeholder="ドメインで検索..."
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>
            <div style={dashboardStyles.filterGroup}>
              <label style={dashboardStyles.filterLabel}>フィルタ:</label>
              <select
                style={dashboardStyles.filterSelect}
                onChange={(e) => {
                  const val = (e.target as HTMLSelectElement).value;
                  if (val === "nrd") setSearchQuery("NRD");
                  else if (val === "login") setSearchQuery("login");
                  else setSearchQuery("");
                }}
              >
                <option value="">すべて</option>
                <option value="nrd">NRDのみ</option>
                <option value="login">ログインページのみ</option>
              </select>
            </div>
          </div>
          <ServicesTable services={services} searchQuery={searchQuery} />
        </section>
      )}

      {activeTab === "events" && (
        <section style={dashboardStyles.section}>
          <div style={dashboardStyles.sectionHeader}>
            <h2 style={dashboardStyles.sectionTitle}>イベントログ</h2>
            <span style={dashboardStyles.sectionCount}>{events.length}件</span>
          </div>
          <div style={dashboardStyles.filterBar}>
            <div style={dashboardStyles.filterGroup}>
              <label style={dashboardStyles.filterLabel}>検索:</label>
              <input
                type="text"
                style={dashboardStyles.filterInput}
                placeholder="イベントタイプ、ドメインで検索..."
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
          <EventLogTable events={events} searchQuery={searchQuery} />
        </section>
      )}
    </div>
  );
}
