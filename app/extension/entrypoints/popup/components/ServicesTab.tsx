import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import type { DetectedService } from "@pleno-audit/detectors";
import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DetectionConfig } from "@pleno-audit/extension-runtime";
import { DEFAULT_DETECTION_CONFIG } from "@pleno-audit/extension-runtime";
import { useTheme } from "../../../lib/theme";
import { Badge } from "../../../components";
import {
  aggregateServices,
  sortServices,
  type UnifiedService,
  type ServiceTag,
  type SortType,
} from "../utils/serviceAggregator";
import { DetectionSettings } from "./DetectionSettings";

interface ServicesTabProps {
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
      return <Badge variant="danger" size="sm">Typosquat</Badge>;
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

export function ServicesTab({ services, violations, networkRequests }: ServicesTabProps) {
  const { colors } = useTheme();
  const [unifiedServices, setUnifiedServices] = useState<UnifiedService[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sortType, setSortType] = useState<SortType>("activity");
  const [detectionConfig, setDetectionConfig] = useState<DetectionConfig>(DEFAULT_DETECTION_CONFIG);

  const sortedServices = useMemo(
    () => sortServices(unifiedServices, sortType),
    [unifiedServices, sortType]
  );

  // 初回のみ設定を取得してデータをロード
  useEffect(() => {
    async function initialLoad() {
      setLoading(true);
      try {
        const config = await chrome.runtime.sendMessage({ type: "GET_DETECTION_CONFIG" });
        if (config) setDetectionConfig(config);
        const result = await aggregateServices(services, networkRequests, violations, config || DEFAULT_DETECTION_CONFIG);
        setUnifiedServices(result);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    initialLoad();
  }, [services, violations, networkRequests]);

  // 設定変更時は再計算（ローディング状態にしない）
  const handleConfigChange = useCallback(async (newConfig: DetectionConfig) => {
    setDetectionConfig(newConfig);
    try {
      const result = await aggregateServices(services, networkRequests, violations, newConfig);
      setUnifiedServices(result);
    } catch (error) {
      console.error("Failed to update services:", error);
    }
  }, [services, networkRequests, violations]);

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

  const styles = {
    container: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "8px",
    },
    header: {
      fontSize: "12px",
      fontWeight: 500,
      color: colors.textSecondary,
      marginBottom: "4px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: "13px",
      textAlign: "center" as const,
      padding: "16px",
    },
    serviceItem: {
      background: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: "8px",
      overflow: "hidden",
    },
    serviceHeader: {
      display: "flex",
      flexDirection: "column" as const,
      padding: "10px 12px",
      cursor: "pointer",
      transition: "background 0.15s",
    },
    serviceHeaderRow: {
      display: "flex",
      alignItems: "center",
      gap: "3px",
    },
    chevron: {
      fontSize: "10px",
      color: colors.textSecondary,
      transition: "transform 0.2s",
      width: "16px",
      textAlign: "center" as const,
    },
    chevronExpanded: {
      transform: "rotate(90deg)",
    },
    icon: {
      width: "20px",
      height: "20px",
      borderRadius: "4px",
      flexShrink: 0,
    },
    iconPlaceholder: {
      width: "20px",
      height: "20px",
      borderRadius: "4px",
      background: colors.bgSecondary,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "10px",
      color: colors.textSecondary,
      flexShrink: 0,
    },
    serviceName: {
      flex: 1,
      fontSize: "13px",
      color: colors.textPrimary,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
      fontFamily: "monospace",
    },
    timestamp: {
      fontSize: "10px",
      color: colors.textMuted,
      flexShrink: 0,
    },
    tagColumn: {
      display: "flex",
      alignItems: "center",
      gap: "3px",
      flexShrink: 0,
    },
    connectionList: {
      borderTop: `1px solid ${colors.borderLight}`,
      background: colors.bgSecondary,
      padding: "8px 12px 8px 48px",
    },
    connectionItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "4px 0",
      fontSize: "12px",
    },
    connectionName: {
      color: colors.textSecondary,
      fontFamily: "monospace",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap" as const,
    },
    connectionCount: {
      color: colors.textMuted,
      fontSize: "11px",
      flexShrink: 0,
      marginLeft: "8px",
    },
    summary: {
      fontSize: "11px",
      color: colors.textSecondary,
      textAlign: "center" as const,
      padding: "8px",
      borderTop: `1px solid ${colors.borderLight}`,
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
  };

  if (loading) {
    return <p style={styles.emptyText}>読み込み中...</p>;
  }

  if (sortedServices.length === 0) {
    return (
      <div style={styles.container}>
        <p style={styles.emptyText}>サービスはまだ検出されていません</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>サービス ({sortedServices.length})</span>
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

      {sortedServices.slice(0, 15).map((service) => {
        const isExpanded = expandedIds.has(service.id);
        const isDomain = service.source.type === "domain";
        const displayName = isDomain
          ? service.source.domain
          : service.source.extensionName;
        const icon = isDomain ? null : service.source.icon;
        const domain = isDomain ? service.source.domain : "";

        return (
          <div key={service.id} style={styles.serviceItem}>
            <div
              style={styles.serviceHeader}
              onClick={() => toggleExpand(service.id)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.bgSecondary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <div style={styles.serviceHeaderRow}>
                <span
                  style={{
                    ...styles.chevron,
                    ...(isExpanded ? styles.chevronExpanded : {}),
                  }}
                >
                  ▶
                </span>
                {isDomain && service.faviconUrl ? (
                  <img src={service.faviconUrl} style={styles.icon} alt="" />
                ) : isDomain ? (
                  <div style={styles.iconPlaceholder}>🌐</div>
                ) : icon ? (
                  <img src={icon} style={styles.icon} alt="" />
                ) : (
                  <div style={styles.iconPlaceholder}>E</div>
                )}
                <span style={styles.serviceName} title={displayName}>
                  {!isDomain && "Extension: "}
                  {displayName}
                </span>
                {service.lastActivity > 0 && (
                  <span style={styles.timestamp}>
                    {formatRelativeTime(service.lastActivity)}
                  </span>
                )}
                {service.tags.length > 0 && (
                  <div style={styles.tagColumn}>
                    {service.tags.map((tag, i) => (
                      <TagBadge key={i} tag={tag} domain={domain} />
                    ))}
                  </div>
                )}
                {service.connections.length > 0 && (
                  <Badge size="sm">{service.connections.length}</Badge>
                )}
              </div>
            </div>

            {isExpanded && (
              <div style={styles.connectionList}>
                {service.connections.length === 0 ? (
                  <div
                    style={{
                      ...styles.connectionItem,
                      color: colors.textMuted,
                      fontStyle: "italic",
                    }}
                  >
                    接続先なし
                  </div>
                ) : (
                  <>
                    {service.connections.slice(0, 10).map((conn) => (
                      <div key={conn.domain} style={styles.connectionItem}>
                        <span style={styles.connectionName} title={conn.domain}>
                          {conn.domain.length > 30
                            ? conn.domain.substring(0, 30) + "..."
                            : conn.domain}
                        </span>
                        <span style={styles.connectionCount}>{conn.requestCount}</span>
                      </div>
                    ))}
                    {service.connections.length > 10 && (
                      <div
                        style={{
                          ...styles.connectionItem,
                          color: colors.textMuted,
                          fontStyle: "italic",
                        }}
                      >
                        他 {service.connections.length - 10} 件
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {sortedServices.length > 15 && (
        <p style={{ ...styles.emptyText, padding: "8px" }}>
          他 {sortedServices.length - 15} 件のサービス
        </p>
      )}

      <div style={styles.summary}>
        合計: {sortedServices.length} サービス
      </div>

      <DetectionSettings onConfigChange={handleConfigChange} />
    </div>
  );
}
