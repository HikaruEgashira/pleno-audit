import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, Button, Card, DataTable, SearchInput, Select } from "../../components";
import { useTheme, type ThemeColors } from "../../lib/theme";
import type { ExtensionRequestRecord, ExtensionInfo } from "@pleno-audit/extension-runtime";

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + "..." : str || "";
}

interface ExtensionStats {
  byExtension: Record<string, { name: string; count: number; domains: string[] }>;
  byDomain: Record<string, { count: number; extensions: string[] }>;
  total: number;
}

function createStyles(colors: ThemeColors) {
  return {
    viewToggle: {
      display: "flex",
      gap: "8px",
      marginBottom: "16px",
    },
    filterBar: {
      display: "flex",
      gap: "12px",
      alignItems: "center",
      marginBottom: "16px",
      flexWrap: "wrap" as const,
    },
    twoColumn: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
      marginBottom: "24px",
    },
    extensionIcon: {
      width: "16px",
      height: "16px",
      marginRight: "8px",
      verticalAlign: "middle",
    },
    extensionName: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: "center" as const,
      padding: "24px",
    },
  };
}

export function ExtensionsTab() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [requests, setRequests] = useState<ExtensionRequestRecord[]>([]);
  const [extensions, setExtensions] = useState<Record<string, ExtensionInfo>>({});
  const [stats, setStats] = useState<ExtensionStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExtension, setSelectedExtension] = useState("");
  const [viewMode, setViewMode] = useState<"summary" | "details">("summary");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const [reqResult, extResult, statsResult] = await Promise.all([
        chrome.runtime.sendMessage({ type: "GET_EXTENSION_REQUESTS", data: { limit: 500 } }),
        chrome.runtime.sendMessage({ type: "GET_KNOWN_EXTENSIONS" }),
        chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATS" }),
      ]);

      setRequests(reqResult?.requests || []);
      setExtensions(extResult || {});
      setStats(statsResult || null);
    } catch (error) {
      console.error("Failed to load extension data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const extensionSummary = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byExtension)
      .map(([id, data]) => ({
        id,
        name: data.name,
        requestCount: data.count,
        domainCount: data.domains.length,
        domains: data.domains,
      }))
      .sort((a, b) => b.requestCount - a.requestCount);
  }, [stats]);

  const domainSummary = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byDomain)
      .map(([domain, data]) => ({
        domain,
        requestCount: data.count,
        extensionCount: data.extensions.length,
        extensions: data.extensions,
      }))
      .sort((a, b) => b.requestCount - a.requestCount);
  }, [stats]);

  const extensionOptions = useMemo(() => {
    return extensionSummary.map((e) => ({ value: e.id, label: e.name }));
  }, [extensionSummary]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (selectedExtension && r.extensionId !== selectedExtension) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.url.toLowerCase().includes(q) ||
          r.domain.toLowerCase().includes(q) ||
          r.extensionName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, selectedExtension, searchQuery]);

  if (loading) {
    return <p style={styles.emptyText}>読み込み中...</p>;
  }

  return (
    <div>
      <div style={styles.viewToggle}>
        <Button
          variant={viewMode === "summary" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setViewMode("summary")}
        >
          サマリー
        </Button>
        <Button
          variant={viewMode === "details" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setViewMode("details")}
        >
          詳細ログ
        </Button>
      </div>

      {viewMode === "summary" && (
        <div style={styles.twoColumn}>
          <Card title="拡張機能別リクエスト数">
            {extensionSummary.length === 0 ? (
              <p style={styles.emptyText}>拡張機能のリクエストは記録されていません</p>
            ) : (
              <DataTable
                data={extensionSummary}
                rowKey={(e) => e.id}
                emptyMessage="データなし"
                columns={[
                  {
                    key: "name",
                    header: "拡張機能",
                    render: (e) => (
                      <div style={styles.extensionName}>
                        {extensions[e.id]?.icons?.[0]?.url && (
                          <img
                            src={extensions[e.id].icons![0].url}
                            style={styles.extensionIcon}
                            alt=""
                          />
                        )}
                        <span>{e.name}</span>
                      </div>
                    ),
                  },
                  {
                    key: "requests",
                    header: "リクエスト",
                    width: "100px",
                    render: (e) => <Badge>{e.requestCount}</Badge>,
                  },
                  {
                    key: "domains",
                    header: "通信先",
                    width: "100px",
                    render: (e) => `${e.domainCount} ドメイン`,
                  },
                ]}
              />
            )}
          </Card>

          <Card title="通信先ドメイン別">
            {domainSummary.length === 0 ? (
              <p style={styles.emptyText}>データなし</p>
            ) : (
              <DataTable
                data={domainSummary.slice(0, 20)}
                rowKey={(d) => d.domain}
                emptyMessage="データなし"
                columns={[
                  {
                    key: "domain",
                    header: "ドメイン",
                    render: (d) => <code style={{ fontSize: "12px" }}>{d.domain}</code>,
                  },
                  {
                    key: "requests",
                    header: "リクエスト",
                    width: "100px",
                    render: (d) => d.requestCount,
                  },
                  {
                    key: "extensions",
                    header: "拡張機能",
                    width: "100px",
                    render: (d) => d.extensionCount,
                  },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      {viewMode === "details" && (
        <div>
          <div style={styles.filterBar}>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="URL、ドメイン、拡張機能名で検索..."
            />
            <Select
              value={selectedExtension}
              onChange={setSelectedExtension}
              options={extensionOptions}
              placeholder="拡張機能を選択"
            />
            {selectedExtension && (
              <Button variant="secondary" size="sm" onClick={() => setSelectedExtension("")}>
                クリア
              </Button>
            )}
          </div>

          <DataTable
            data={filteredRequests}
            rowKey={(r) => r.id}
            emptyMessage="リクエストは記録されていません"
            columns={[
              {
                key: "timestamp",
                header: "日時",
                width: "160px",
                render: (r) => new Date(r.timestamp).toLocaleString("ja-JP"),
              },
              {
                key: "extension",
                header: "拡張機能",
                width: "140px",
                render: (r) => (
                  <div style={styles.extensionName}>
                    {extensions[r.extensionId]?.icons?.[0]?.url && (
                      <img
                        src={extensions[r.extensionId].icons![0].url}
                        style={styles.extensionIcon}
                        alt=""
                      />
                    )}
                    <span title={r.extensionName}>{truncate(r.extensionName, 15)}</span>
                  </div>
                ),
              },
              {
                key: "method",
                header: "Method",
                width: "80px",
                render: (r) => <code style={{ fontSize: "11px" }}>{r.method}</code>,
              },
              {
                key: "domain",
                header: "ドメイン",
                width: "160px",
                render: (r) => r.domain,
              },
              {
                key: "url",
                header: "URL",
                render: (r) => <span title={r.url}>{truncate(r.url, 50)}</span>,
              },
              {
                key: "type",
                header: "種類",
                width: "80px",
                render: (r) => <Badge>{r.resourceType}</Badge>,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
