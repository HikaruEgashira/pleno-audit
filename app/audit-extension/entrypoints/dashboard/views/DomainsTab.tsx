import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { Notification } from "../../../components";
import { Badge, Button, DataTable } from "../../../components";

interface DomainStat {
  label: string;
  value: number;
}

interface DomainsTabProps {
  styles: Record<string, any>;
  domainStats: DomainStat[];
  violations: CSPViolation[];
  networkRequests: NetworkRequest[];
  onNotify: (notification: Omit<Notification, "id" | "timestamp">) => void;
}

export function DomainsTab({
  styles,
  domainStats,
  violations,
  networkRequests,
  onNotify,
}: DomainsTabProps) {
  return (
    <div style={styles.section}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <Button
          onClick={async () => {
            try {
              const policy = await chrome.runtime.sendMessage({
                type: "GENERATE_CSP",
              });
              if (policy?.policyString) {
                const blob = new Blob([policy.policyString], {
                  type: "text/plain",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `csp-policy-${new Date().toISOString().slice(0, 10)}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }
            } catch (err) {
              console.error("CSP generation failed:", err);
              onNotify({
                severity: "warning",
                title: "CSP生成失敗",
                message: "CSPの生成に失敗しました。時間をおいて再試行してください。",
                autoDismiss: 6000,
              });
            }
          }}
        >
          CSPポリシー生成
        </Button>
      </div>

      <DataTable
        data={domainStats.map((d, i) => {
          const domainViolations = violations.filter((v) => {
            try {
              return new URL(v.blockedURL).hostname === d.label;
            } catch {
              return false;
            }
          });
          const timestamps = domainViolations.map((v) =>
            new Date(v.timestamp).getTime()
          );
          const lastSeenMs = timestamps.length > 0 ? Math.max(...timestamps) : 0;
          return {
            ...d,
            requests: networkRequests.filter((r) => r.domain === d.label).length,
            lastSeen: lastSeenMs,
            index: i,
          };
        })}
        rowKey={(d) => d.label}
        rowHighlight={(d) => d.value > 10}
        emptyMessage="ドメインデータなし"
        columns={[
          {
            key: "domain",
            header: "ドメイン",
            render: (d) => (
              <code style={{ fontSize: "12px" }}>{d.label}</code>
            ),
          },
          {
            key: "violations",
            header: "違反数",
            width: "100px",
            render: (d) =>
              d.value > 0 ? <Badge variant="danger">{d.value}</Badge> : "-",
          },
          {
            key: "requests",
            header: "リクエスト数",
            width: "120px",
            render: (d) => d.requests,
          },
          {
            key: "lastSeen",
            header: "最終検出",
            width: "160px",
            render: (d) =>
              d.lastSeen ? new Date(d.lastSeen).toLocaleString("ja-JP") : "-",
          },
        ]}
      />
    </div>
  );
}
