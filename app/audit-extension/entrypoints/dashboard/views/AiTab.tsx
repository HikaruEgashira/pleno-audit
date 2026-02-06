import type { CapturedAIPrompt } from "@pleno-audit/detectors";
import { Badge, DataTable, SearchInput } from "../../../components";
import { truncate } from "../dashboard-utils";

interface AiTabProps {
  styles: Record<string, any>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredAIPrompts: CapturedAIPrompt[];
}

export function AiTab({
  styles,
  searchQuery,
  onSearchChange,
  filteredAIPrompts,
}: AiTabProps) {
  return (
    <div style={styles.section}>
      <div style={styles.filterBar}>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Provider、Model、エンドポイントで検索..."
        />
      </div>
      <DataTable
        data={filteredAIPrompts}
        rowKey={(p) => p.id}
        emptyMessage="AIプロンプトは記録されていません"
        columns={[
          {
            key: "timestamp",
            header: "日時",
            width: "160px",
            render: (p) => new Date(p.timestamp).toLocaleString("ja-JP"),
          },
          {
            key: "provider",
            header: "Provider",
            width: "100px",
            render: (p) => {
              try {
                return (
                  <Badge>
                    {p.provider && p.provider !== "unknown"
                      ? p.provider
                      : new URL(p.apiEndpoint).hostname}
                  </Badge>
                );
              } catch {
                return <Badge>{p.provider || p.apiEndpoint || "unknown"}</Badge>;
              }
            },
          },
          {
            key: "model",
            header: "Model",
            width: "120px",
            render: (p) => (
              <code style={{ fontSize: "11px" }}>{p.model || "-"}</code>
            ),
          },
          {
            key: "prompt",
            header: "プロンプト",
            render: (p) =>
              truncate(p.prompt.messages?.[0]?.content || p.prompt.text || "", 50),
          },
          {
            key: "latency",
            header: "レスポンス",
            width: "100px",
            render: (p) =>
              p.response ? <Badge>{p.response.latencyMs}ms</Badge> : "-",
          },
        ]}
      />
    </div>
  );
}
