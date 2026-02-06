import type { CSPViolation } from "@pleno-audit/csp";
import type { CapturedAIPrompt, DetectedService, EventLog } from "@pleno-audit/detectors";
import type { ThemeColors } from "../../../lib/theme";
import { Badge, Card } from "../../../components";
import { HorizontalBarChart } from "../dashboard-components";

interface OverviewTabProps {
  styles: Record<string, any>;
  colors: ThemeColors;
  isDark: boolean;
  events: EventLog[];
  nrdServices: DetectedService[];
  services: DetectedService[];
  violations: CSPViolation[];
  aiPrompts: CapturedAIPrompt[];
  directiveStats: { label: string; value: number }[];
  domainStats: { label: string; value: number }[];
}

export function OverviewTab({
  styles,
  colors,
  isDark,
  events,
  nrdServices,
  services,
  violations,
  aiPrompts,
  directiveStats,
  domainStats,
}: OverviewTabProps) {
  return (
    <>
      <Card title="セキュリティスコア" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "32px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color:
                  nrdServices.length === 0 && violations.length < 10
                    ? "#22c55e"
                    : nrdServices.length > 0
                      ? "#dc2626"
                      : "#f97316",
              }}
            >
              {Math.max(
                0,
                100 -
                  nrdServices.length * 20 -
                  Math.floor(violations.length / 10) * 5 -
                  services.filter((s) => s.typosquatResult?.isTyposquat).length *
                    30
              )}
            </div>
            <div style={{ fontSize: "12px", color: colors.textSecondary }}>
              / 100
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: nrdServices.length > 0 ? "#dc2626" : "#22c55e",
                }}
              />
              <span style={{ fontSize: "13px" }}>
                NRD検出: {nrdServices.length}件
              </span>
              {nrdServices.length > 0 && (
                <Badge variant="danger" size="sm">
                  -{nrdServices.length * 20}pt
                </Badge>
              )}
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background:
                    services.filter((s) => s.typosquatResult?.isTyposquat)
                      .length > 0
                      ? "#dc2626"
                      : "#22c55e",
                }}
              />
              <span style={{ fontSize: "13px" }}>
                Typosquat: {services.filter((s) => s.typosquatResult?.isTyposquat).length}件
              </span>
              {services.filter((s) => s.typosquatResult?.isTyposquat).length > 0 && (
                <Badge variant="danger" size="sm">
                  -{services.filter((s) => s.typosquatResult?.isTyposquat).length * 30}pt
                </Badge>
              )}
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: violations.length > 50 ? "#f97316" : "#22c55e",
                }}
              />
              <span style={{ fontSize: "13px" }}>
                CSP違反: {violations.length}件
              </span>
              {violations.length >= 10 && (
                <Badge variant="warning" size="sm">
                  -{Math.floor(violations.length / 10) * 5}pt
                </Badge>
              )}
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: aiPrompts.length > 0 ? "#3b82f6" : "#6b7280",
                }}
              />
              <span style={{ fontSize: "13px" }}>
                AI利用: {aiPrompts.length}件
              </span>
              <Badge variant="info" size="sm">
                監視中
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card title="7日間のアクティビティ" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "80px" }}>
          {(() => {
            const days = 7;
            const dayData: number[] = [];
            const dayRanges: { start: number; end: number }[] = [];
            const now = Date.now();
            for (let i = days - 1; i >= 0; i -= 1) {
              const dayStart = now - (i + 1) * 24 * 60 * 60 * 1000;
              const dayEnd = now - i * 24 * 60 * 60 * 1000;
              const count = events.filter(
                (e) => e.timestamp >= dayStart && e.timestamp < dayEnd
              ).length;
              dayData.push(count);
              dayRanges.push({ start: dayStart, end: dayEnd });
            }
            const maxCount = Math.max(...dayData, 1);
            const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
            const todayIndex = new Date().getDay();
            return dayData.map((count, i) => {
              const dayOfWeek = (todayIndex - (days - 1 - i) + 7) % 7;
              const height = Math.max(4, (count / maxCount) * 60);
              const range = dayRanges[i];
              const hasRisk =
                events.filter((e) => {
                  return (
                    e.timestamp >= range.start &&
                    e.timestamp < range.end &&
                    (e.type.includes("nrd") || e.type.includes("typosquat"))
                  );
                }).length > 0;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${height}px`,
                      background: hasRisk
                        ? "#dc2626"
                        : count > 0
                          ? colors.interactive
                          : colors.bgSecondary,
                      borderRadius: "4px 4px 0 0",
                    }}
                    title={`${count}件`}
                  />
                  <span style={{ fontSize: "10px", color: colors.textSecondary }}>
                    {dayLabels[dayOfWeek]}
                  </span>
                </div>
              );
            });
          })()}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "8px",
            fontSize: "11px",
            color: colors.textSecondary,
          }}
        >
          <span>7日前</span>
          <span>今日</span>
        </div>
      </Card>

      <div style={styles.twoColumn}>
        <HorizontalBarChart
          data={directiveStats}
          title="Directive別違反数"
          colors={colors}
          isDark={isDark}
        />
        <HorizontalBarChart
          data={domainStats}
          title="ドメイン別違反数"
          colors={colors}
          isDark={isDark}
        />
      </div>

      <Card title="最近のイベント">
        {events.slice(0, 10).length === 0 ? (
          <p style={styles.emptyText}>イベントなし</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {events.slice(0, 10).map((e) => (
              <div key={e.id} style={styles.eventItem}>
                <span style={styles.eventTime}>
                  {new Date(e.timestamp).toLocaleTimeString("ja-JP")}
                </span>
                <Badge
                  variant={
                    e.type.includes("violation") || e.type.includes("nrd")
                      ? "danger"
                      : e.type.includes("ai") || e.type.includes("login")
                        ? "warning"
                        : "default"
                  }
                >
                  {e.type}
                </Badge>
                <code style={styles.code}>{e.domain}</code>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="セキュリティ推奨事項" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {nrdServices.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #dc2626",
              }}
            >
              <Badge variant="danger">Critical</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                  NRDサイトへのアクセスを確認
                </div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {nrdServices.map((s) => s.domain).join(", ")} への接続が検出されました。
                  これらは新規登録ドメインであり、フィッシングの可能性があります。
                </div>
              </div>
            </div>
          )}
          {services.filter((s) => s.typosquatResult?.isTyposquat).length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #dc2626",
              }}
            >
              <Badge variant="danger">Critical</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                  タイポスクワットの疑い
                </div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {services
                    .filter((s) => s.typosquatResult?.isTyposquat)
                    .map((s) => s.domain)
                    .join(", ")} は
                  正規サイトの偽装の可能性があります。URLを再確認してください。
                </div>
              </div>
            </div>
          )}
          {services.filter((s) => !s.privacyPolicyUrl).length > 5 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #f97316",
              }}
            >
              <Badge variant="warning">High</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                  プライバシーポリシー未確認のサイト
                </div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {services.filter((s) => !s.privacyPolicyUrl).length}件のサイトでプライバシーポリシーが確認できません。
                  個人情報の取り扱いに注意してください。
                </div>
              </div>
            </div>
          )}
          {aiPrompts.length > 10 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #3b82f6",
              }}
            >
              <Badge variant="info">Info</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                  AI利用の監視
                </div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {aiPrompts.length}件のAIプロンプトが記録されています。
                  機密情報をAIに送信していないか確認してください。
                </div>
              </div>
            </div>
          )}
          {violations.length > 50 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                background: colors.bgSecondary,
                borderRadius: "8px",
                borderLeft: "3px solid #eab308",
              }}
            >
              <Badge variant="warning">Medium</Badge>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                  CSP違反の増加
                </div>
                <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                  {violations.length}件のCSP違反が検出されています。
                  サードパーティスクリプトの監視を強化することを推奨します。
                </div>
              </div>
            </div>
          )}
          {nrdServices.length === 0 &&
            services.filter((s) => s.typosquatResult?.isTyposquat).length === 0 &&
            violations.length < 50 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  background: colors.bgSecondary,
                  borderRadius: "8px",
                  borderLeft: "3px solid #22c55e",
                }}
              >
                <Badge variant="success">Good</Badge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                    セキュリティ状態は良好です
                  </div>
                  <div style={{ fontSize: "12px", color: colors.textSecondary }}>
                    重大なセキュリティリスクは検出されていません。引き続き監視を継続します。
                  </div>
                </div>
              </div>
            )}
        </div>
      </Card>
    </>
  );
}
