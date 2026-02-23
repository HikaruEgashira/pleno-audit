import { useState, useEffect, useMemo } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/detectors";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import { createLogger } from "@pleno-audit/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { Badge, Button } from "../../../components";
import {
  aggregateServices,
  type ServiceTag,
  type SortType,
} from "../utils/serviceAggregator";
import {
  buildServiceIndex,
  queryServiceIndex,
  type FilterCategory,
} from "../utils/serviceExplorer";
import { usePopupStyles } from "../styles";

const logger = createLogger("popup-service-tab");

interface ServiceTabProps {
  services: DetectedService[];
  violations: CSPViolation[];
  networkRequests: NetworkRequest[];
}

function sanitizeUrl(url: string, domain: string): string {
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

function TagBadge({ tag, domain }: { tag: ServiceTag; domain: string }) {
  switch (tag.type) {
    case "nrd":
      return (
        <Badge variant="danger" size="sm">
          NRD{tag.domainAge !== null ? ` (${tag.domainAge}d)` : ""}
        </Badge>
      );
    case "typosquat":
      return <Badge variant="warning" size="sm">Typosquat</Badge>;
    case "ai":
      return <Badge variant="warning" size="sm">AI</Badge>;
    case "login":
      return <Badge variant="warning" size="sm">login</Badge>;
    case "privacy":
      return (
        <a
          href={sanitizeUrl(tag.url, domain)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          <Badge size="sm">privacy</Badge>
        </a>
      );
    case "tos":
      return (
        <a
          href={sanitizeUrl(tag.url, domain)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          <Badge size="sm">tos</Badge>
        </a>
      );
    case "cookie":
      return <Badge size="sm">{tag.count} cookie</Badge>;
    default:
      return null;
  }
}

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "activity", label: "アクティビティ順" },
  { value: "connections", label: "接続数順" },
  { value: "name", label: "名前順" },
];

function formatRelativeTime(timestamp: number): string {
  if (timestamp === 0) return "";
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}日前`;
  if (hours > 0) return `${hours}時間前`;
  if (minutes > 0) return `${minutes}分前`;
  return "たった今";
}

export function ServiceTab({ services, violations, networkRequests }: ServiceTabProps) {
  const { colors } = useTheme();
  const popupStyles = usePopupStyles();
  const [unifiedServices, setUnifiedServices] = useState<UnifiedService[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sortType, setSortType] = useState<SortType>("activity");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterCategory>>(new Set());

  const serviceIndex = useMemo(
    () => buildServiceIndex(unifiedServices),
    [unifiedServices]
  );

  const queryResult = useMemo(
    () =>
      queryServiceIndex(serviceIndex, {
        sortType,
        searchQuery,
        activeFilters,
        limit: 100,
      }),
    [serviceIndex, sortType, searchQuery, activeFilters]
  );

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const result = await aggregateServices(services, networkRequests, violations);
        setUnifiedServices(result);
      } catch (error) {
        logger.warn({
          event: "POPUP_AGGREGATE_SERVICES_FAILED",
          error,
        });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [services, violations, networkRequests]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleFilter(category: FilterCategory) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  const styles = {
    emptyText: {
      color: colors.textMuted,
      fontSize: "13px",
      textAlign: "center" as const,
      padding: "16px",
    },
    filterBar: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      flexWrap: "wrap" as const,
      marginBottom: "12px",
    },
    filterInput: {
      flex: 1,
      minWidth: "120px",
      padding: "6px 10px",
      border: `1px solid ${colors.border}`,
      borderRadius: "6px",
      fontSize: "12px",
      background: colors.bgPrimary,
      color: colors.textPrimary,
      outline: "none",
    },
    sortSelect: {
      background: colors.bgSecondary,
      border: `1px solid ${colors.border}`,
      borderRadius: "4px",
      padding: "2px 6px",
      fontSize: "11px",
      color: colors.textSecondary,
      cursor: "pointer",
      outline: "none",
    },
    connectionRow: {
      paddingLeft: "48px",
      background: colors.bgSecondary,
    },
    connectionName: {
      color: colors.textSecondary,
      fontFamily: "monospace",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
  };

  if (loading) {
    return <p style={styles.emptyText}>読み込み中...</p>;
  }

  if (serviceIndex.entries.length === 0) {
    return (
      <div style={popupStyles.tabContent}>
        <p style={styles.emptyText}>サービスはまだ検出されていません</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={styles.filterBar}>
        <input
          type="search"
          aria-label="サービス検索"
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          placeholder="検索..."
          style={styles.filterInput}
        />
        {serviceIndex.counts.nrd > 0 && (
          <Button
            variant={activeFilters.has("nrd") ? "primary" : "secondary"}
            size="sm"
            onClick={() => toggleFilter("nrd")}
          >
            NRD ({serviceIndex.counts.nrd})
          </Button>
        )}
        {serviceIndex.counts.typosquat > 0 && (
          <Button
            variant={activeFilters.has("typosquat") ? "primary" : "secondary"}
            size="sm"
            onClick={() => toggleFilter("typosquat")}
          >
            Typosquat ({serviceIndex.counts.typosquat})
          </Button>
        )}
        {serviceIndex.counts.ai > 0 && (
          <Button
            variant={activeFilters.has("ai") ? "primary" : "secondary"}
            size="sm"
            onClick={() => toggleFilter("ai")}
          >
            AI ({serviceIndex.counts.ai})
          </Button>
        )}
        {serviceIndex.counts.login > 0 && (
          <Button
            variant={activeFilters.has("login") ? "primary" : "secondary"}
            size="sm"
            onClick={() => toggleFilter("login")}
          >
            login ({serviceIndex.counts.login})
          </Button>
        )}
        {serviceIndex.counts.extension > 0 && (
          <Button
            variant={activeFilters.has("extension") ? "primary" : "secondary"}
            size="sm"
            onClick={() => toggleFilter("extension")}
          >
            Extension ({serviceIndex.counts.extension})
          </Button>
        )}
        <select
          value={sortType}
          onChange={(e) => setSortType((e.target as HTMLSelectElement).value as SortType)}
          style={styles.sortSelect}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...popupStyles.card, padding: 0, overflow: "hidden" }}>
        <table style={{ ...popupStyles.table, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "24px" }} />
            <col style={{ width: "130px" }} />
            <col />
            <col style={{ width: "64px" }} />
            <col style={{ width: "56px" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={popupStyles.tableHeader}></th>
              <th style={popupStyles.tableHeader}>Name</th>
              <th style={popupStyles.tableHeader}>Tags</th>
              <th style={popupStyles.tableHeader}>Connections</th>
              <th style={{ ...popupStyles.tableHeader, textAlign: "right" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {queryResult.services.map((service) => {
              const hasConnections = service.connections.length > 0;
              const isExpanded = hasConnections && expandedIds.has(service.id);
              const isDomain = service.source.type === "domain";
              const displayName = isDomain
                ? service.source.domain
                : service.source.extensionName;
              const icon = isDomain ? null : service.source.icon;
              const domain = isDomain ? service.source.domain : "";

              return [
                <tr key={service.id} style={popupStyles.tableRow}>
                  <td style={popupStyles.tableCell}>
                    <button
                      onClick={() => hasConnections && toggleExpand(service.id)}
                      disabled={!hasConnections}
                      aria-label={isExpanded ? "接続を折りたたむ" : "接続を展開する"}
                      aria-expanded={isExpanded}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: hasConnections ? "pointer" : "default",
                        opacity: hasConnections ? 1 : 0.4,
                        padding: 0,
                        color: colors.textSecondary,
                        fontSize: "10px",
                        transition: "transform 0.2s",
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    >
                      ▶
                    </button>
                  </td>
                  <td style={popupStyles.tableCell}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {isDomain && service.faviconUrl ? (
                        <img
                          src={service.faviconUrl}
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "2px",
                            flexShrink: 0,
                          }}
                          alt=""
                        />
                      ) : isDomain ? (
                        <span style={{ fontSize: "14px", flexShrink: 0 }}>🌐</span>
                      ) : icon ? (
                        <img
                          src={icon}
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "2px",
                            flexShrink: 0,
                          }}
                          alt=""
                        />
                      ) : (
                        <span style={{ fontSize: "12px", flexShrink: 0 }}>E</span>
                      )}
                      <code
                        style={{
                          ...popupStyles.code,
                          background: "transparent",
                          padding: 0,
                          fontSize: "12px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={displayName}
                      >
                        {displayName}
                      </code>
                    </div>
                  </td>
                  <td style={popupStyles.tableCell}>
                    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                      {service.tags
                        .filter((t) => ["nrd", "typosquat", "ai", "login"].includes(t.type))
                        .map((tag, i) => (
                          <TagBadge key={i} tag={tag} domain={domain} />
                        ))}
                    </div>
                  </td>
                  <td style={popupStyles.tableCell}>
                    {service.connections.length > 0 && (
                      <Badge size="sm">{service.connections.length}</Badge>
                    )}
                  </td>
                  <td
                    style={{
                      ...popupStyles.tableCell,
                      textAlign: "right",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: colors.textMuted,
                    }}
                  >
                    {formatRelativeTime(service.lastActivity)}
                  </td>
                </tr>,
                isExpanded &&
                  service.connections.length > 0 &&
                  service.connections.slice(0, 10).map((conn) => (
                    <tr key={`${service.id}-${conn.domain}`} style={popupStyles.tableRow}>
                      <td style={{ ...popupStyles.tableCell, padding: "4px 6px" }}></td>
                      <td
                        colSpan={4}
                        style={{
                          ...popupStyles.tableCell,
                          ...styles.connectionRow,
                          padding: "4px 12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <code
                            style={{
                              ...styles.connectionName,
                              fontSize: "11px",
                            }}
                            title={conn.domain}
                          >
                            └ {conn.domain}
                          </code>
                          <span
                            style={{
                              color: colors.textMuted,
                              fontSize: "10px",
                              marginLeft: "8px",
                            }}
                          >
                            {conn.requestCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )),
                isExpanded &&
                  service.connections.length > 10 && (
                    <tr key={`${service.id}-more`} style={popupStyles.tableRow}>
                      <td
                        colSpan={5}
                        style={{
                          ...popupStyles.tableCell,
                          ...styles.connectionRow,
                          padding: "4px 12px",
                          color: colors.textMuted,
                          fontStyle: "italic",
                          fontSize: "11px",
                        }}
                      >
                        他 {service.connections.length - 10} 件
                      </td>
                    </tr>
                  ),
              ];
            })}
          </tbody>
        </table>
        {queryResult.hasMore && (
          <div
            style={{
              padding: "8px",
              textAlign: "center",
              fontSize: "11px",
              color: colors.textMuted,
              borderTop: `1px solid ${colors.borderLight}`,
            }}
          >
            +{queryResult.total - 100} more
          </div>
        )}
        {queryResult.total === 0 && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              fontSize: "12px",
              color: colors.textMuted,
            }}
          >
            該当するサービスがありません
          </div>
        )}
      </div>
    </div>
  );
}
