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
type OperationMode = "risk" | "daily" | "investigation";

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

function OperationModeSelector({
  mode,
  onChange,
}: {
  mode: OperationMode;
  onChange: (m: OperationMode) => void;
}) {
  const modes: { id: OperationMode; label: string; icon: string; desc: string }[] = [
    { id: "risk", label: "リスク監視", icon: "⚠", desc: "重大な問題に集中" },
    { id: "daily", label: "日常確認", icon: "📊", desc: "通常の監視業務" },
    { id: "investigation", label: "詳細調査", icon: "🔍", desc: "問題の深掘り調査" },
  ];
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {modes.map((m) => (
        <button
          key={m.id}
          style={{
            padding: "8px 16px",
            border: mode === m.id ? "2px solid hsl(0 0% 20%)" : "1px solid hsl(0 0% 80%)",
            borderRadius: "6px",
            background: mode === m.id ? "hsl(0 0% 20%)" : "white",
            color: mode === m.id ? "white" : "hsl(0 0% 30%)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: mode === m.id ? 600 : 400,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
          onClick={() => onChange(m.id)}
          title={m.desc}
        >
          <span>{m.icon}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
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

// アクションアイテムリスト（運用者向け）
interface ActionItem {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
}

function ActionList({
  items,
  mode,
}: {
  items: ActionItem[];
  mode: OperationMode;
}) {
  // モードに応じてフィルタリング
  const filteredItems = useMemo(() => {
    if (mode === "risk") {
      return items.filter((i) => i.priority === "critical" || i.priority === "high");
    }
    if (mode === "daily") {
      return items.slice(0, 5);
    }
    return items;
  }, [items, mode]);

  const priorityStyles: Record<string, { bg: string; border: string; icon: string }> = {
    critical: { bg: "hsl(0 80% 95%)", border: "hsl(0 70% 50%)", icon: "🔴" },
    high: { bg: "hsl(30 80% 95%)", border: "hsl(30 70% 50%)", icon: "🟠" },
    medium: { bg: "hsl(45 80% 95%)", border: "hsl(45 70% 50%)", icon: "🟡" },
    low: { bg: "hsl(0 0% 96%)", border: "hsl(0 0% 70%)", icon: "⚪" },
  };

  if (filteredItems.length === 0) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "hsl(0 0% 50%)" }}>
        対応が必要なアクションはありません
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {filteredItems.map((item) => {
        const style = priorityStyles[item.priority];
        return (
          <div
            key={item.id}
            style={{
              padding: "12px 16px",
              background: style.bg,
              borderLeft: `4px solid ${style.border}`,
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
              <span style={{ fontSize: "16px" }}>{style.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{item.title}</div>
                <div style={{ fontSize: "12px", color: "hsl(0 0% 45%)" }}>{item.description}</div>
              </div>
            </div>
            <button
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                background: "white",
                border: `1px solid ${style.border}`,
                borderRadius: "4px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={item.action}
            >
              {item.actionLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// 時系列タイムライン表示
function TimelineChart({
  events,
  period,
}: {
  events: EventLog[];
  period: Period;
}) {
  const buckets = useMemo(() => {
    const now = Date.now();
    const cutoff = now - getPeriodMs(period);
    const filtered = events.filter((e) => e.timestamp >= cutoff);

    // 時間帯ごとにグループ化
    let bucketSize: number;
    let bucketCount: number;
    if (period === "1h") {
      bucketSize = 5 * 60 * 1000; // 5分
      bucketCount = 12;
    } else if (period === "24h") {
      bucketSize = 60 * 60 * 1000; // 1時間
      bucketCount = 24;
    } else if (period === "7d") {
      bucketSize = 24 * 60 * 60 * 1000; // 1日
      bucketCount = 7;
    } else {
      bucketSize = 24 * 60 * 60 * 1000;
      bucketCount = 30;
    }

    const result: { time: string; critical: number; warning: number; info: number }[] = [];
    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketSize;
      const bucketEnd = now - i * bucketSize;
      const bucketEvents = filtered.filter((e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd);

      let label: string;
      if (period === "1h") {
        label = new Date(bucketEnd).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      } else if (period === "24h") {
        label = new Date(bucketEnd).toLocaleTimeString("ja-JP", { hour: "2-digit" }) + "時";
      } else {
        label = new Date(bucketEnd).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
      }

      result.push({
        time: label,
        critical: bucketEvents.filter((e) => e.type.includes("nrd") || e.type.includes("violation")).length,
        warning: bucketEvents.filter((e) => e.type.includes("ai") || e.type.includes("login")).length,
        info: bucketEvents.filter((e) => !e.type.includes("nrd") && !e.type.includes("violation") && !e.type.includes("ai") && !e.type.includes("login")).length,
      });
    }
    return result;
  }, [events, period]);

  const maxValue = Math.max(...buckets.map((b) => b.critical + b.warning + b.info), 1);

  return (
    <div style={dashboardStyles.card}>
      <h3 style={dashboardStyles.cardTitle}>イベントタイムライン</h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "100px", padding: "8px 0" }}>
        {buckets.map((bucket, i) => {
          const total = bucket.critical + bucket.warning + bucket.info;
          const height = (total / maxValue) * 100;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "flex-end",
              }}
              title={`${bucket.time}: 重大${bucket.critical} 注意${bucket.warning} 情報${bucket.info}`}
            >
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  height: `${height}%`,
                  minHeight: total > 0 ? "4px" : "0",
                }}
              >
                {bucket.critical > 0 && (
                  <div style={{ background: "hsl(0 70% 50%)", flex: bucket.critical }} />
                )}
                {bucket.warning > 0 && (
                  <div style={{ background: "hsl(45 100% 45%)", flex: bucket.warning }} />
                )}
                {bucket.info > 0 && (
                  <div style={{ background: "hsl(210 100% 65%)", flex: bucket.info }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "hsl(0 0% 50%)" }}>
        <span>{buckets[0]?.time}</span>
        <span>{buckets[buckets.length - 1]?.time}</span>
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "11px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "10px", height: "10px", background: "hsl(0 70% 50%)", borderRadius: "2px" }} />
          重大
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "10px", height: "10px", background: "hsl(45 100% 45%)", borderRadius: "2px" }} />
          注意
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "10px", height: "10px", background: "hsl(210 100% 65%)", borderRadius: "2px" }} />
          情報
        </span>
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
    if (q === "no-policy") {
      return services.filter((s) => !s.privacyPolicyUrl && !s.termsOfServiceUrl);
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
  // URLハッシュから初期タブを取得
  const getInitialTab = (): TabType => {
    const hash = window.location.hash.slice(1);
    const validTabs: TabType[] = ["overview", "violations", "network", "domains", "ai", "services", "events"];
    return validTabs.includes(hash as TabType) ? (hash as TabType) : "overview";
  };

  const [period, setPeriod] = useState<Period>("24h");
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [directiveFilter, setDirectiveFilter] = useState("");
  const [aiPrompts, setAIPrompts] = useState<CapturedAIPrompt[]>([]);
  const [services, setServices] = useState<DetectedService[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [operationMode, setOperationMode] = useState<OperationMode>("daily");

  // タブ変更時にURLハッシュを更新
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  // ブラウザの戻る/進むボタン対応
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as TabType;
      const validTabs: TabType[] = ["overview", "violations", "network", "domains", "ai", "services", "events"];
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
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
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + 数字でタブ切り替え
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "7") {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tabIds: TabType[] = ["overview", "violations", "network", "domains", "ai", "services", "events"];
        if (tabIds[tabIndex]) {
          setActiveTab(tabIds[tabIndex]);
        }
      }
      // R で更新
      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        loadData();
      }
      // / で検索にフォーカス
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
      }
      // Escape で検索クリア/ヘルプ閉じる
      if (e.key === "Escape") {
        setSearchQuery("");
        setDirectiveFilter("");
        setShowHelp(false);
      }
      // ? でヘルプ表示
      if (e.key === "?" && !(e.target instanceof HTMLInputElement)) {
        setShowHelp((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const handleExportOperationReport = () => {
    const now = new Date();
    const periodLabel = { "1h": "1時間", "24h": "24時間", "7d": "7日間", "30d": "30日間", all: "全期間" }[period];

    // 期間内のデータを取得
    const cutoff = Date.now() - getPeriodMs(period);
    const periodViolations = reports.filter((r) => r.type === "csp-violation" && r.timestamp >= cutoff) as CSPViolation[];
    const periodEvents = events.filter((e) => e.timestamp >= cutoff);
    const periodAIPrompts = aiPrompts.filter((p) => p.timestamp >= cutoff);
    const nrdList = services.filter((s) => s.nrdResult?.isNRD);
    const loginList = services.filter((s) => s.hasLoginPage);

    // セキュリティスコア計算
    const score = Math.max(0, 100 - (nrdList.length * 30) - (periodViolations.length * 0.5) - (periodAIPrompts.length * 2));

    const reportContent = `
================================================================================
CASB/Browser Security 運用レポート
================================================================================
生成日時: ${now.toLocaleString("ja-JP")}
対象期間: ${periodLabel}
接続モード: ${connectionMode}

--------------------------------------------------------------------------------
エグゼクティブサマリー
--------------------------------------------------------------------------------
セキュリティスコア: ${score.toFixed(0)}/100
ステータス: ${nrdList.length > 0 ? "要対応" : periodViolations.length > 50 ? "注意" : periodAIPrompts.length > 0 ? "監視中" : "正常"}

重要指標:
  - CSP違反: ${periodViolations.length}件
  - NRD検出: ${nrdList.length}件
  - AIプロンプト送信: ${periodAIPrompts.length}件
  - ログインページ検出: ${loginList.length}件
  - 検出サービス総数: ${services.length}件

--------------------------------------------------------------------------------
要対応アクション
--------------------------------------------------------------------------------
${nrdList.length > 0 ? `[重大] NRD（新規登録ドメイン）検出
${nrdList.map((s) => `  - ${s.domain} (経過日数: ${s.nrdResult?.domainAge || "不明"}日)`).join("\n")}
` : ""}
${periodViolations.filter((v) => ["script-src", "default-src"].includes(v.directive)).length > 0 ? `[高] 重要CSP違反 (${periodViolations.filter((v) => ["script-src", "default-src"].includes(v.directive)).length}件)
  対象ディレクティブ: script-src, default-src
` : ""}
${periodAIPrompts.length > 0 ? `[中] AIプロンプト送信 (${periodAIPrompts.length}件)
  機密情報の送信がないか確認が必要
` : ""}
${!nrdList.length && !periodViolations.filter((v) => ["script-src", "default-src"].includes(v.directive)).length && !periodAIPrompts.length ? "対応が必要なアクションはありません。\n" : ""}
--------------------------------------------------------------------------------
CSP違反サマリー
--------------------------------------------------------------------------------
総件数: ${periodViolations.length}件

Directive別内訳:
${Object.entries(periodViolations.reduce((acc, v) => {
      acc[v.directive] = (acc[v.directive] || 0) + 1;
      return acc;
    }, {} as Record<string, number>))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([d, c]) => `  - ${d}: ${c}件`)
      .join("\n") || "  (データなし)"}

--------------------------------------------------------------------------------
検出サービス一覧
--------------------------------------------------------------------------------
総数: ${services.length}件

NRDサービス:
${nrdList.map((s) => `  - ${s.domain}`).join("\n") || "  (なし)"}

ログインページ検出:
${loginList.slice(0, 10).map((s) => `  - ${s.domain}`).join("\n") || "  (なし)"}
${loginList.length > 10 ? `  ... 他${loginList.length - 10}件` : ""}

--------------------------------------------------------------------------------
AIプロンプト監視
--------------------------------------------------------------------------------
総送信数: ${periodAIPrompts.length}件
${periodAIPrompts.length > 0 ? `
プロバイダー別:
${Object.entries(periodAIPrompts.reduce((acc, p) => {
      const provider = p.provider || "unknown";
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>))
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `  - ${p}: ${c}件`)
      .join("\n")}
` : ""}
--------------------------------------------------------------------------------
レポート終了
================================================================================
    `.trim();

    const blob = new Blob([reportContent], { type: "text/plain; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `casb-operation-report-${now.toISOString().slice(0, 10)}.txt`;
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

  // アクションアイテム生成
  const actionItems = useMemo((): ActionItem[] => {
    const items: ActionItem[] = [];

    // NRD検出（Critical）
    nrdServices.forEach((s, i) => {
      items.push({
        id: `nrd-${i}`,
        priority: "critical",
        title: `新規登録ドメイン(NRD)検出: ${s.domain}`,
        description: `ドメイン経過日数: ${s.nrdResult?.domainAge || "不明"}日 - フィッシングの可能性を確認`,
        action: () => {
          setActiveTab("services");
          setSearchQuery(s.domain);
        },
        actionLabel: "確認する",
      });
    });

    // 重要CSP違反（High）
    const criticalViolations = violations.filter((v) =>
      ["script-src", "default-src"].includes(v.directive)
    );
    if (criticalViolations.length > 0) {
      items.push({
        id: "csp-critical",
        priority: "high",
        title: `重要CSP違反: ${criticalViolations.length}件`,
        description: "script-src, default-srcの違反を確認してください",
        action: () => {
          setActiveTab("violations");
          setDirectiveFilter("script-src");
        },
        actionLabel: "違反を確認",
      });
    }

    // AIプロンプト送信（High）
    if (aiPrompts.length > 0) {
      const recentAI = aiPrompts.filter(
        (p) => Date.now() - p.timestamp < 60 * 60 * 1000
      );
      if (recentAI.length > 0) {
        items.push({
          id: "ai-recent",
          priority: "high",
          title: `直近1時間のAIプロンプト: ${recentAI.length}件`,
          description: "機密情報の送信がないか確認してください",
          action: () => setActiveTab("ai"),
          actionLabel: "確認する",
        });
      }
    }

    // ログインページ検出（Medium）
    if (loginServices.length > 0) {
      items.push({
        id: "login-detected",
        priority: "medium",
        title: `ログインページ検出: ${loginServices.length}サービス`,
        description: "新しく検出されたログインページを確認",
        action: () => {
          setActiveTab("services");
          setSearchQuery("login");
        },
        actionLabel: "サービス確認",
      });
    }

    // CSP違反多発（Medium）
    if (violations.length > 20) {
      items.push({
        id: "csp-many",
        priority: "medium",
        title: `CSP違反が多発: ${violations.length}件`,
        description: "CSPポリシーの見直しを検討してください",
        action: () => setActiveTab("domains"),
        actionLabel: "ドメイン分析",
      });
    }

    // 日常確認項目（Low）
    items.push({
      id: "daily-check",
      priority: "low",
      title: "日常確認: イベントログ",
      description: `本日のイベント: ${events.filter((e) => Date.now() - e.timestamp < 24 * 60 * 60 * 1000).length}件`,
      action: () => setActiveTab("events"),
      actionLabel: "ログ確認",
    });

    return items;
  }, [nrdServices, violations, aiPrompts, loginServices, events]);

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: "overview", label: "概要" },
    { id: "violations", label: "CSP違反", count: violations.length },
    { id: "network", label: "ネットワーク", count: networkRequests.length },
    { id: "domains", label: "ドメイン分析" },
    { id: "ai", label: "AI監視", count: aiPrompts.length },
    { id: "services", label: "サービス", count: services.length },
    { id: "events", label: "イベント", count: events.length },
  ];

  // セキュリティステータス判定
  const getSecurityStatus = () => {
    if (nrdServices.length > 0) return { level: "critical", label: "要対応", color: "hsl(0 70% 50%)" };
    if (violations.length > 50) return { level: "warning", label: "注意", color: "hsl(45 100% 40%)" };
    if (aiPrompts.length > 0) return { level: "info", label: "監視中", color: "hsl(210 100% 45%)" };
    return { level: "ok", label: "正常", color: "hsl(120 50% 40%)" };
  };
  const securityStatus = getSecurityStatus();

  return (
    <div style={dashboardStyles.container}>
      <header style={dashboardStyles.header}>
        <div style={dashboardStyles.headerLeft}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={dashboardStyles.title}>CASB Dashboard</h1>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "white",
                background: securityStatus.color,
              }}
            >
              {securityStatus.label}
            </span>
          </div>
          <p style={dashboardStyles.subtitle}>
            Browser Security Monitor | 更新: {new Date(lastUpdated).toLocaleString("ja-JP")} |
            接続: {connectionMode}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <OperationModeSelector mode={operationMode} onChange={setOperationMode} />
          <PeriodSelector period={period} onChange={setPeriod} />
          <button
            style={{
              ...dashboardStyles.btnSmall,
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
            onClick={() => setShowHelp(true)}
            title="ヘルプ (?)"
          >
            ?
          </button>
        </div>
      </header>

      {/* ヘルプモーダル */}
      {showHelp && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>CASB Dashboard ヘルプ</h2>

            <h3 style={{ fontSize: "14px", margin: "16px 0 8px", color: "hsl(0 0% 40%)" }}>
              キーボードショートカット
            </h3>
            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Ctrl/Cmd + 1-7", "タブ切り替え"],
                  ["R", "データ更新"],
                  ["/", "検索にフォーカス"],
                  ["Escape", "検索クリア / ヘルプ閉じる"],
                  ["?", "ヘルプ表示"],
                ].map(([key, desc]) => (
                  <tr key={key} style={{ borderBottom: "1px solid hsl(0 0% 90%)" }}>
                    <td style={{ padding: "8px 0" }}>
                      <code style={dashboardStyles.code}>{key}</code>
                    </td>
                    <td style={{ padding: "8px 0" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ fontSize: "14px", margin: "16px 0 8px", color: "hsl(0 0% 40%)" }}>
              ステータスバッジ
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li><strong style={{ color: "hsl(0 70% 50%)" }}>要対応</strong>: NRD（新規登録ドメイン）検出</li>
              <li><strong style={{ color: "hsl(45 100% 40%)" }}>注意</strong>: CSP違反50件以上</li>
              <li><strong style={{ color: "hsl(210 100% 45%)" }}>監視中</strong>: AIプロンプト送信あり</li>
              <li><strong style={{ color: "hsl(120 50% 40%)" }}>正常</strong>: 問題なし</li>
            </ul>

            <h3 style={{ fontSize: "14px", margin: "16px 0 8px", color: "hsl(0 0% 40%)" }}>
              運用モード
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li><strong>リスク監視</strong>: 重大なセキュリティ問題に集中（NRD、重要CSP違反）</li>
              <li><strong>日常確認</strong>: 通常の監視業務用（上位5件のアクションを表示）</li>
              <li><strong>詳細調査</strong>: 特定の問題を深掘り（全アクション・詳細フィルター）</li>
            </ul>

            <h3 style={{ fontSize: "14px", margin: "16px 0 8px", color: "hsl(0 0% 40%)" }}>
              タブ説明
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li><strong>概要</strong>: アクションリスト、セキュリティスコア、統計</li>
              <li><strong>CSP違反</strong>: Content Security Policy違反の詳細</li>
              <li><strong>ネットワーク</strong>: 外部リクエストの監視</li>
              <li><strong>ドメイン分析</strong>: ドメイン別の統計とCSPポリシー生成</li>
              <li><strong>AI監視</strong>: AIサービスへのプロンプト送信監視</li>
              <li><strong>サービス</strong>: 検出したSaaSサービス一覧</li>
              <li><strong>イベント</strong>: 全イベントログ</li>
            </ul>

            <button
              style={{ ...dashboardStyles.btn, marginTop: "20px", width: "100%" }}
              onClick={() => setShowHelp(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* クイックステータスバー */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          padding: "12px 16px",
          background: "hsl(0 0% 97%)",
          borderRadius: "8px",
          marginBottom: "16px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "hsl(0 0% 50%)" }}>ステータス:</span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
              background: securityStatus.color,
              color: "white",
            }}
          >
            {securityStatus.label}
          </span>
        </div>
        <div style={{ height: "20px", width: "1px", background: "hsl(0 0% 80%)" }} />
        <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
          <span
            style={{
              cursor: nrdServices.length > 0 ? "pointer" : "default",
              color: nrdServices.length > 0 ? "hsl(0 70% 50%)" : "hsl(0 0% 50%)",
              fontWeight: nrdServices.length > 0 ? 600 : 400,
            }}
            onClick={() => nrdServices.length > 0 && (setActiveTab("services"), setSearchQuery("nrd"))}
          >
            NRD: {nrdServices.length}
          </span>
          <span
            style={{
              cursor: violations.length > 0 ? "pointer" : "default",
              color: violations.length > 50 ? "hsl(45 100% 35%)" : "hsl(0 0% 50%)",
              fontWeight: violations.length > 50 ? 600 : 400,
            }}
            onClick={() => violations.length > 0 && setActiveTab("violations")}
          >
            CSP違反: {violations.length}
          </span>
          <span
            style={{
              cursor: aiPrompts.length > 0 ? "pointer" : "default",
              color: aiPrompts.length > 0 ? "hsl(210 100% 45%)" : "hsl(0 0% 50%)",
              fontWeight: aiPrompts.length > 0 ? 600 : 400,
            }}
            onClick={() => aiPrompts.length > 0 && setActiveTab("ai")}
          >
            AI: {aiPrompts.length}
          </span>
          <span style={{ color: "hsl(0 0% 50%)" }}>
            サービス: {services.length}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: "11px", color: "hsl(0 0% 60%)" }}>
          対象期間: {period === "1h" ? "1時間" : period === "24h" ? "24時間" : period === "7d" ? "7日" : period === "30d" ? "30日" : "全期間"}
        </div>
      </div>

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
        <button
          style={{
            ...dashboardStyles.btn,
            opacity: isRefreshing ? 0.7 : 1,
            position: "relative",
          }}
          onClick={() => loadData()}
          disabled={isRefreshing}
        >
          {isRefreshing ? "更新中..." : "更新"}
          {isRefreshing && (
            <span
              style={{
                position: "absolute",
                right: "-20px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "12px",
                height: "12px",
                border: "2px solid hsl(0 0% 80%)",
                borderTopColor: "hsl(0 0% 40%)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          )}
        </button>
        <button style={dashboardStyles.btnSecondary} onClick={handleClearData}>
          データ削除
        </button>
        <button
          style={{
            ...dashboardStyles.btn,
            background: "hsl(210 100% 45%)",
          }}
          onClick={handleExportOperationReport}
        >
          運用レポート
        </button>
        <button style={dashboardStyles.btnSecondary} onClick={handleExportJSON}>
          JSON
        </button>
        <button style={dashboardStyles.btnSecondary} onClick={handleExportCSV}>
          CSV
        </button>
        <span style={dashboardStyles.refreshNote}>5秒ごとに自動更新</span>
      </div>

      <div style={dashboardStyles.tabs}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            style={
              activeTab === tab.id
                ? dashboardStyles.tabActive
                : dashboardStyles.tab
            }
            onClick={() => setActiveTab(tab.id)}
            title={`${tab.label} (Ctrl+${index + 1})`}
          >
            <span
              style={{
                fontSize: "9px",
                color: "hsl(0 0% 60%)",
                marginRight: "4px",
              }}
            >
              {index + 1}
            </span>
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
          {/* セキュリティスコアとモード説明 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div style={{ ...dashboardStyles.card, display: "flex", alignItems: "center", gap: "24px" }}>
              <div style={{ textAlign: "center", minWidth: "120px" }}>
                <div
                  style={{
                    fontSize: "48px",
                    fontWeight: 700,
                    color: nrdServices.length > 0
                      ? "hsl(0 70% 50%)"
                      : violations.length > 50
                        ? "hsl(45 100% 40%)"
                        : violations.length > 10
                          ? "hsl(45 100% 50%)"
                          : "hsl(120 50% 40%)",
                  }}
                >
                  {Math.max(0, 100 - (nrdServices.length * 30) - (violations.length * 0.5) - (aiPrompts.length * 2)).toFixed(0)}
                </div>
                <div style={{ fontSize: "12px", color: "hsl(0 0% 50%)", textTransform: "uppercase" }}>
                  セキュリティスコア
                </div>
              </div>
              <div style={{ flex: 1, fontSize: "13px", color: "hsl(0 0% 40%)" }}>
                <div style={{ marginBottom: "8px" }}>
                  <strong>評価基準:</strong>
                </div>
                <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: 1.8 }}>
                  <li>NRD検出: <span style={{ color: nrdServices.length > 0 ? "hsl(0 70% 50%)" : "hsl(120 50% 40%)" }}>{nrdServices.length}件 (-30点/件)</span></li>
                  <li>CSP違反: <span style={{ color: violations.length > 50 ? "hsl(0 70% 50%)" : "hsl(0 0% 40%)" }}>{violations.length}件 (-0.5点/件)</span></li>
                  <li>AIプロンプト: <span style={{ color: aiPrompts.length > 0 ? "hsl(45 100% 40%)" : "hsl(0 0% 40%)" }}>{aiPrompts.length}件 (-2点/件)</span></li>
                </ul>
              </div>
            </div>
            <div style={dashboardStyles.card}>
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ fontSize: "14px" }}>
                  {operationMode === "risk" && "⚠ リスク監視モード"}
                  {operationMode === "daily" && "📊 日常確認モード"}
                  {operationMode === "investigation" && "🔍 詳細調査モード"}
                </strong>
              </div>
              <div style={{ fontSize: "13px", color: "hsl(0 0% 45%)", lineHeight: 1.6 }}>
                {operationMode === "risk" && (
                  <>
                    <p style={{ margin: "0 0 8px" }}>重大なセキュリティリスクに集中するモードです。</p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      <li>NRD（新規登録ドメイン）の確認</li>
                      <li>重要CSP違反の対応</li>
                      <li>AIプロンプト送信の監視</li>
                    </ul>
                  </>
                )}
                {operationMode === "daily" && (
                  <>
                    <p style={{ margin: "0 0 8px" }}>通常の監視業務に適したモードです。</p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      <li>上位5件のアクションを表示</li>
                      <li>全体のセキュリティ状況を確認</li>
                      <li>定期的なログチェック</li>
                    </ul>
                  </>
                )}
                {operationMode === "investigation" && (
                  <>
                    <p style={{ margin: "0 0 8px" }}>特定の問題を深掘りするモードです。</p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      <li>全てのアクションを表示</li>
                      <li>詳細なフィルタリング</li>
                      <li>根本原因の特定</li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* アクションリスト */}
          <div style={dashboardStyles.section}>
            <div style={dashboardStyles.sectionHeader}>
              <h3 style={dashboardStyles.cardTitle}>
                対応アクション
                <span style={{ fontSize: "12px", fontWeight: 400, marginLeft: "8px", color: "hsl(0 0% 50%)" }}>
                  ({actionItems.filter((i) => i.priority === "critical" || i.priority === "high").length}件の重要アクション)
                </span>
              </h3>
            </div>
            <div style={dashboardStyles.card}>
              <ActionList items={actionItems} mode={operationMode} />
            </div>
          </div>

          {/* タイムライン */}
          <div style={{ marginBottom: "24px" }}>
            <TimelineChart events={events} period={period} />
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
            <button
              style={dashboardStyles.btnSecondary}
              onClick={async () => {
                try {
                  const policy = await chrome.runtime.sendMessage({ type: "GENERATE_CSP" });
                  if (policy?.policyString) {
                    const blob = new Blob([policy.policyString], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `csp-policy-${new Date().toISOString().slice(0, 10)}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                } catch (e) {
                  console.error("CSP生成エラー:", e);
                }
              }}
            >
              CSPポリシー生成
            </button>
          </div>

          {/* CSP推奨事項 */}
          {violations.length > 0 && (
            <div style={{ ...dashboardStyles.alertCard, marginBottom: "16px" }}>
              <div style={dashboardStyles.alertTitle}>CSPポリシー推奨事項</div>
              <ul style={dashboardStyles.alertList}>
                {directiveStats.slice(0, 3).map((d) => (
                  <li key={d.label}>
                    <strong>{d.label}</strong>: {d.value}件の違反 -
                    許可リストの見直しを推奨
                  </li>
                ))}
                <li>
                  「CSPポリシー生成」ボタンで推奨ポリシーをダウンロードできます
                </li>
              </ul>
            </div>
          )}

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

          {/* リスクレベル別クイックフィルター */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <button
              style={{
                ...dashboardStyles.btnSmall,
                background: searchQuery === "" ? "hsl(0 0% 20%)" : "white",
                color: searchQuery === "" ? "white" : "hsl(0 0% 30%)",
                border: "1px solid hsl(0 0% 70%)",
              }}
              onClick={() => setSearchQuery("")}
            >
              全て ({services.length})
            </button>
            <button
              style={{
                ...dashboardStyles.btnSmall,
                background: searchQuery === "nrd" ? "hsl(0 70% 50%)" : "hsl(0 80% 95%)",
                color: searchQuery === "nrd" ? "white" : "hsl(0 70% 40%)",
                border: `1px solid hsl(0 70% 50%)`,
              }}
              onClick={() => setSearchQuery(searchQuery === "nrd" ? "" : "nrd")}
            >
              🔴 NRD ({nrdServices.length})
            </button>
            <button
              style={{
                ...dashboardStyles.btnSmall,
                background: searchQuery === "login" ? "hsl(45 100% 40%)" : "hsl(45 80% 95%)",
                color: searchQuery === "login" ? "white" : "hsl(45 80% 30%)",
                border: `1px solid hsl(45 100% 40%)`,
              }}
              onClick={() => setSearchQuery(searchQuery === "login" ? "" : "login")}
            >
              🟡 ログイン ({loginServices.length})
            </button>
            <button
              style={{
                ...dashboardStyles.btnSmall,
                background: searchQuery === "no-policy" ? "hsl(210 100% 45%)" : "hsl(210 80% 95%)",
                color: searchQuery === "no-policy" ? "white" : "hsl(210 80% 35%)",
                border: `1px solid hsl(210 100% 45%)`,
              }}
              onClick={() => setSearchQuery(searchQuery === "no-policy" ? "" : "no-policy")}
            >
              🔵 ポリシー未検出 ({services.filter((s) => !s.privacyPolicyUrl && !s.termsOfServiceUrl).length})
            </button>
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

          {/* イベントタイプ別統計 */}
          {events.length > 0 && (
            <div style={{ ...dashboardStyles.statsGrid, marginBottom: "16px" }}>
              {Object.entries(
                events.reduce((acc, e) => {
                  acc[e.type] = (acc[e.type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([type, count]) => (
                  <div
                    key={type}
                    style={{
                      ...dashboardStyles.statCard,
                      cursor: "pointer",
                      border: searchQuery === type ? "2px solid hsl(0 0% 30%)" : "none",
                    }}
                    onClick={() => setSearchQuery(searchQuery === type ? "" : type)}
                  >
                    <div style={dashboardStyles.statValue}>{count}</div>
                    <div style={{ ...dashboardStyles.statLabel, fontSize: "10px" }}>{type}</div>
                  </div>
                ))}
            </div>
          )}

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
            <div style={dashboardStyles.filterGroup}>
              <label style={dashboardStyles.filterLabel}>タイプ:</label>
              <select
                style={dashboardStyles.filterSelect}
                value={searchQuery}
                onChange={(e) => setSearchQuery((e.target as HTMLSelectElement).value)}
              >
                <option value="">すべて</option>
                <option value="csp_violation">CSP違反</option>
                <option value="login_detected">ログイン検出</option>
                <option value="ai_prompt_sent">AIプロンプト</option>
                <option value="nrd_detected">NRD検出</option>
                <option value="privacy_policy_found">プライバシーポリシー</option>
                <option value="cookie_set">Cookie設定</option>
              </select>
            </div>
          </div>
          <EventLogTable events={events} searchQuery={searchQuery} />
        </section>
      )}
    </div>
  );
}
