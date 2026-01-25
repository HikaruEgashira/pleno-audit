import { useState, useEffect, useMemo } from "preact/hooks";
import { Badge, Card, DataTable, Button, SearchInput } from "../../../components";
import type { ThemeColors } from "../../../lib/theme";
import { createLogger } from "@pleno-audit/extension-runtime";

const logger = createLogger("extensions-tab");

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  permissions: string[];
  hostPermissions: string[];
  installType: string;
  type: string;
  mayDisable: boolean;
  icons?: { size: number; url: string }[];
}

interface ExtensionsTabProps {
  colors: ThemeColors;
}

// 権限のリスクレベルを判定
function getPermissionRiskLevel(permissions: string[], hostPermissions: string[]): "critical" | "high" | "medium" | "low" {
  const criticalPermissions = [
    "debugger",
    "nativeMessaging",
    "proxy",
    "webRequestBlocking",
  ];
  const highRiskPermissions = [
    "cookies",
    "history",
    "tabs",
    "webNavigation",
    "webRequest",
    "management",
    "downloads",
    "clipboardRead",
    "clipboardWrite",
  ];
  const mediumRiskPermissions = [
    "storage",
    "activeTab",
    "contextMenus",
    "notifications",
    "alarms",
  ];

  const allPermissions = [...permissions, ...hostPermissions];

  // <all_urls> や広範なホスト権限をチェック
  const hasAllUrls = hostPermissions.some(
    (p) => p === "<all_urls>" || p === "*://*/*" || p === "http://*/*" || p === "https://*/*"
  );

  if (allPermissions.some((p) => criticalPermissions.includes(p)) || hasAllUrls) {
    return "critical";
  }
  if (allPermissions.some((p) => highRiskPermissions.includes(p))) {
    return "high";
  }
  if (allPermissions.some((p) => mediumRiskPermissions.includes(p))) {
    return "medium";
  }
  return "low";
}

function getRiskBadgeVariant(level: "critical" | "high" | "medium" | "low") {
  switch (level) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "success";
  }
}

function getRiskLabel(level: "critical" | "high" | "medium" | "low") {
  switch (level) {
    case "critical":
      return "重大";
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
  }
}

export function ExtensionsTab({ colors }: ExtensionsTabProps) {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExtension, setSelectedExtension] = useState<ExtensionInfo | null>(null);

  useEffect(() => {
    async function loadExtensions() {
      try {
        // chrome.management APIで拡張機能リストを取得
        const allExtensions = await chrome.management.getAll();

        // 自分自身を除外し、必要な情報を整形
        const extensionList: ExtensionInfo[] = allExtensions
          .filter((ext) => ext.id !== chrome.runtime.id) // 自分自身を除外
          .map((ext) => ({
            id: ext.id,
            name: ext.name,
            version: ext.version,
            enabled: ext.enabled,
            permissions: ext.permissions || [],
            hostPermissions: ext.hostPermissions || [],
            installType: ext.installType,
            type: ext.type,
            mayDisable: ext.mayDisable,
            icons: ext.icons,
          }));

        setExtensions(extensionList);
      } catch (error) {
        logger.error("Failed to load extensions", error);
      } finally {
        setLoading(false);
      }
    }

    loadExtensions();
  }, []);

  const filteredExtensions = useMemo(() => {
    if (!searchQuery) return extensions;
    const q = searchQuery.toLowerCase();
    return extensions.filter(
      (ext) =>
        ext.name.toLowerCase().includes(q) ||
        ext.permissions.some((p) => p.toLowerCase().includes(q))
    );
  }, [extensions, searchQuery]);

  // 統計情報
  const stats = useMemo(() => {
    const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    const permissionCounts: Record<string, number> = {};

    for (const ext of extensions) {
      if (!ext.enabled) continue;

      const risk = getPermissionRiskLevel(ext.permissions, ext.hostPermissions);
      riskCounts[risk]++;

      for (const perm of [...ext.permissions, ...ext.hostPermissions]) {
        permissionCounts[perm] = (permissionCounts[perm] || 0) + 1;
      }
    }

    const topPermissions = Object.entries(permissionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([permission, count]) => ({ permission, count }));

    return { riskCounts, topPermissions };
  }, [extensions]);

  if (loading) {
    return (
      <Card title="拡張機能分析">
        <p style={{ textAlign: "center", color: colors.textSecondary }}>読み込み中...</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* リスクサマリー */}
      <Card title="リスクサマリー">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          {(["critical", "high", "medium", "low"] as const).map((level) => (
            <div
              key={level}
              style={{
                padding: "16px",
                backgroundColor: colors.bgSecondary,
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>
                {stats.riskCounts[level]}
              </div>
              <Badge variant={getRiskBadgeVariant(level)}>{getRiskLabel(level)}リスク</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* 権限別利用状況 */}
      <Card title="よく使われている権限 (TOP 8)">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {stats.topPermissions.length === 0 ? (
            <p style={{ color: colors.textSecondary, textAlign: "center" }}>データなし</p>
          ) : (
            stats.topPermissions.map((item) => {
              const isHighRisk = ["<all_urls>", "*://*/*", "cookies", "tabs", "history", "webRequest"].includes(item.permission);
              return (
                <div key={item.permission} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <code
                    style={{
                      fontSize: "12px",
                      minWidth: "180px",
                      color: isHighRisk ? "#f97316" : colors.textPrimary,
                    }}
                  >
                    {item.permission}
                  </code>
                  <div
                    style={{
                      flex: 1,
                      height: "8px",
                      backgroundColor: colors.bgSecondary,
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(item.count / extensions.length) * 100}%`,
                        backgroundColor: isHighRisk ? "#f97316" : colors.interactive,
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "12px", minWidth: "40px", textAlign: "right" }}>
                    {item.count}件
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 拡張機能リスト */}
      <Card title={`インストール済み拡張機能 (${extensions.length}件)`}>
        <div style={{ marginBottom: "16px" }}>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="拡張機能名、権限で検索..."
          />
        </div>
        <DataTable
          data={filteredExtensions}
          rowKey={(ext) => ext.id}
          rowHighlight={(ext) => getPermissionRiskLevel(ext.permissions, ext.hostPermissions) === "critical"}
          emptyMessage="拡張機能が見つかりません"
          columns={[
            {
              key: "name",
              header: "拡張機能名",
              render: (ext) => (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {ext.icons?.[0]?.url && (
                    <img
                      src={ext.icons[0].url}
                      alt=""
                      style={{ width: "16px", height: "16px" }}
                    />
                  )}
                  <span>{ext.name}</span>
                </div>
              ),
            },
            {
              key: "version",
              header: "バージョン",
              width: "100px",
              render: (ext) => <code style={{ fontSize: "11px" }}>{ext.version}</code>,
            },
            {
              key: "permissions",
              header: "権限数",
              width: "80px",
              render: (ext) => {
                const total = ext.permissions.length + ext.hostPermissions.length;
                return (
                  <Badge variant={total > 10 ? "warning" : "default"}>
                    {total}
                  </Badge>
                );
              },
            },
            {
              key: "risk",
              header: "リスク",
              width: "100px",
              render: (ext) => {
                const level = getPermissionRiskLevel(ext.permissions, ext.hostPermissions);
                return (
                  <Badge variant={getRiskBadgeVariant(level)}>
                    {getRiskLabel(level)}
                  </Badge>
                );
              },
            },
            {
              key: "status",
              header: "状態",
              width: "80px",
              render: (ext) => (
                <Badge variant={ext.enabled ? "success" : "default"}>
                  {ext.enabled ? "有効" : "無効"}
                </Badge>
              ),
            },
            {
              key: "action",
              header: "詳細",
              width: "80px",
              render: (ext) => (
                <Button
                  size="sm"
                  onClick={() => setSelectedExtension(selectedExtension?.id === ext.id ? null : ext)}
                >
                  {selectedExtension?.id === ext.id ? "閉じる" : "詳細"}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {/* 詳細パネル */}
      {selectedExtension && (
        <Card title={`${selectedExtension.name} の詳細`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "4px" }}>
                インストールタイプ
              </div>
              <Badge variant={selectedExtension.installType === "admin" ? "warning" : "default"}>
                {selectedExtension.installType}
              </Badge>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
                API権限 ({selectedExtension.permissions.length}件)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {selectedExtension.permissions.length === 0 ? (
                  <span style={{ color: colors.textMuted }}>なし</span>
                ) : (
                  selectedExtension.permissions.map((perm) => (
                    <Badge key={perm} variant="default" size="sm">
                      {perm}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: colors.textSecondary, marginBottom: "8px" }}>
                ホスト権限 ({selectedExtension.hostPermissions.length}件)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {selectedExtension.hostPermissions.length === 0 ? (
                  <span style={{ color: colors.textMuted }}>なし</span>
                ) : (
                  selectedExtension.hostPermissions.map((perm) => {
                    const isAllUrls = perm === "<all_urls>" || perm === "*://*/*";
                    return (
                      <Badge key={perm} variant={isAllUrls ? "danger" : "default"} size="sm">
                        {perm}
                      </Badge>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => chrome.management.get(selectedExtension.id).then(() => {
                  chrome.tabs.create({ url: `chrome://extensions/?id=${selectedExtension.id}` });
                })}
              >
                Chrome設定で開く
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
