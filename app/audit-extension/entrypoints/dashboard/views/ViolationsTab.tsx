import type { CSPViolation } from "@pleno-audit/csp";
import { Badge, DataTable, SearchInput, Select } from "../../../components";
import { truncate } from "../dashboard-utils";

interface ViolationsTabProps {
  styles: Record<string, any>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  directiveFilter: string;
  onDirectiveFilterChange: (value: string) => void;
  directives: string[];
  filteredViolations: CSPViolation[];
}

export function ViolationsTab({
  styles,
  searchQuery,
  onSearchChange,
  directiveFilter,
  onDirectiveFilterChange,
  directives,
  filteredViolations,
}: ViolationsTabProps) {
  return (
    <div style={styles.section}>
      <div style={styles.filterBar}>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="URL、ドメインで検索..."
        />
        <Select
          value={directiveFilter}
          onChange={onDirectiveFilterChange}
          options={directives.map((d) => ({ value: d, label: d }))}
          placeholder="Directive"
        />
      </div>
      <DataTable
        data={filteredViolations}
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
            render: (v) => (
              <span title={v.pageUrl}>{truncate(v.pageUrl, 40)}</span>
            ),
          },
          {
            key: "directive",
            header: "Directive",
            width: "120px",
            render: (v) => (
              <Badge
                variant={
                  ["script-src", "default-src"].includes(v.directive)
                    ? "danger"
                    : "default"
                }
              >
                {v.directive}
              </Badge>
            ),
          },
          {
            key: "blocked",
            header: "ブロックURL",
            render: (v) => (
              <span title={v.blockedURL}>{truncate(v.blockedURL, 40)}</span>
            ),
          },
        ]}
      />
    </div>
  );
}
