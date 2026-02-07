import type { EventLog } from "@pleno-audit/detectors";
import { useMemo, useState } from "preact/hooks";
import { Badge, DataTable, SearchInput, Select } from "../../../components";
import type { DashboardStyles } from "../styles";
import { truncate } from "../utils";

interface EventsTabProps {
  styles: DashboardStyles;
  events: EventLog[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export function EventsTab({ styles, events, searchQuery, setSearchQuery }: EventsTabProps) {
  const [selectedType, setSelectedType] = useState("");

  const filteredEvents = useMemo(() => {
    if (!selectedType) return events;
    return events.filter((e) => e.type === selectedType);
  }, [events, selectedType]);

  return (
    <div style={styles.section}>
      <div style={styles.filterBar}>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="イベントタイプ、ドメインで検索..." />
        <Select
          value={selectedType}
          onChange={setSelectedType}
          options={[
            { value: "csp_violation", label: "CSP違反" },
            { value: "login_detected", label: "ログイン検出" },
            { value: "ai_prompt_sent", label: "AIプロンプト" },
            { value: "nrd_detected", label: "NRD検出" },
          ]}
          placeholder="タイプ"
        />
      </div>
      <DataTable
        data={filteredEvents}
        rowKey={(e) => e.id}
        emptyMessage="イベントは記録されていません"
        columns={[
          {
            key: "timestamp",
            header: "日時",
            width: "160px",
            render: (e) => new Date(e.timestamp).toLocaleString("ja-JP"),
          },
          {
            key: "type",
            header: "タイプ",
            width: "140px",
            render: (e) => (
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
            ),
          },
          {
            key: "domain",
            header: "ドメイン",
            width: "200px",
            render: (e) => <code style={{ fontSize: "12px" }}>{e.domain}</code>,
          },
          {
            key: "details",
            header: "詳細",
            render: (e) => {
              const d = e.details as Record<string, unknown>;
              if (!d) return "-";
              if (e.type === "csp_violation") return `${d.directive}: ${truncate(String(d.blockedURL || ""), 30)}`;
              if (e.type === "ai_prompt_sent") return `${d.provider}/${d.model}`;
              return truncate(JSON.stringify(d) ?? "", 50);
            },
          },
        ]}
      />
    </div>
  );
}
