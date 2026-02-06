import type { NetworkRequest } from "@pleno-audit/csp";
import { Badge, DataTable, SearchInput } from "../../../components";
import { truncate } from "../dashboard-utils";

interface NetworkTabProps {
  styles: Record<string, any>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredNetworkRequests: NetworkRequest[];
}

export function NetworkTab({
  styles,
  searchQuery,
  onSearchChange,
  filteredNetworkRequests,
}: NetworkTabProps) {
  return (
    <div style={styles.section}>
      <div style={styles.filterBar}>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="URL、ドメインで検索..."
        />
      </div>
      <DataTable
        data={filteredNetworkRequests}
        rowKey={(r, i) => `${r.timestamp}-${i}`}
        emptyMessage="ネットワークリクエストは記録されていません"
        columns={[
          {
            key: "timestamp",
            header: "日時",
            width: "160px",
            render: (r) => {
              const ts =
                typeof r.timestamp === "number"
                  ? r.timestamp
                  : new Date(r.timestamp).getTime();
              return new Date(ts).toLocaleString("ja-JP");
            },
          },
          {
            key: "initiatorType",
            header: "送信元",
            width: "120px",
            render: (r) => {
              const record = r as NetworkRequest & {
                initiatorType?: string;
                extensionId?: string;
                extensionName?: string;
              };
              const initiatorType =
                record.initiatorType || (r.initiator ? "page" : "unknown");
              if (initiatorType === "extension") {
                return (
                  <Badge variant="purple">
                    {record.extensionName ||
                      record.extensionId?.slice(0, 8) ||
                      "Extension"}
                  </Badge>
                );
              }
              if (initiatorType === "page") {
                try {
                  const domain = r.initiator
                    ? new URL(r.initiator).hostname
                    : "Page";
                  return <Badge variant="blue">{truncate(domain, 12)}</Badge>;
                } catch {
                  return <Badge variant="blue">Page</Badge>;
                }
              }
              if (initiatorType === "browser") {
                return <Badge variant="gray">Browser</Badge>;
              }
              return <Badge variant="gray">Unknown</Badge>;
            },
          },
          {
            key: "method",
            header: "Method",
            width: "80px",
            render: (r) => (
              <code style={{ fontSize: "11px" }}>{r.method || "GET"}</code>
            ),
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
        ]}
      />
    </div>
  );
}
