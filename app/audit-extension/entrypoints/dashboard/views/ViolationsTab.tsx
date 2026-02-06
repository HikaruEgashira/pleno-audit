import type { CSPViolation } from "@pleno-audit/csp";
import { Badge, DataTable, SearchInput, Select } from "../../../components";
import type { DashboardStyles } from "../styles";
import { truncate } from "../utils";

interface ViolationsTabProps {
  styles: DashboardStyles;
  violations: CSPViolation[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  directiveFilter: string;
  setDirectiveFilter: (value: string) => void;
  directives: string[];
}

export function ViolationsTab({
  styles,
  violations,
  searchQuery,
  setSearchQuery,
  directiveFilter,
  setDirectiveFilter,
  directives,
}: ViolationsTabProps) {
  return (
    <div style={styles.section}>
      <div style={styles.filterBar}>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="URL、ドメインで検索..." />
        <Select
          value={directiveFilter}
          onChange={setDirectiveFilter}
          options={directives.map((d) => ({ value: d, label: d }))}
          placeholder="Directive"
        />
      </div>
      <DataTable
        data={violations}
        rowKey={(v, i) => `${v.timestamp}-${i}`}
        rowHighlight={(v) => ["script-src", "default-src"].includes(v.directive)}
        emptyMessage="CSP違反は記録されていません"
        columns={[
          {
            key: "timestamp",
            header: "日時",
            width: "160px",
            render: (v) => new Date(v.timestamp).toLocaleString("ja-JP"),
          },
          {
            key: "page",
            header: "ページ",
            render: (v) => <span title={v.pageUrl}>{truncate(v.pageUrl, 40)}</span>,
          },
          {
            key: "directive",
            header: "Directive",
            width: "120px",
            render: (v) => (
              <Badge variant={["script-src", "default-src"].includes(v.directive) ? "danger" : "default"}>
                {v.directive}
              </Badge>
            ),
          },
          {
            key: "blocked",
            header: "ブロックURL",
            render: (v) => <span title={v.blockedURL}>{truncate(v.blockedURL, 40)}</span>,
          },
        ]}
      />
    </div>
  );
}
