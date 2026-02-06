import type { DetectedService } from "@pleno-audit/detectors";
import { Badge, Button, DataTable, SearchInput } from "../../../components";
import { truncate } from "../dashboard-utils";

interface ServicesTabProps {
  styles: Record<string, any>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredServices: DetectedService[];
  nrdCount: number;
  loginCount: number;
}

export function ServicesTab({
  styles,
  searchQuery,
  onSearchChange,
  filteredServices,
  nrdCount,
  loginCount,
}: ServicesTabProps) {
  return (
    <div style={styles.section}>
      <div style={styles.filterBar}>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="ドメインで検索..."
        />
        <Button
          variant={searchQuery === "nrd" ? "primary" : "secondary"}
          size="sm"
          onClick={() => onSearchChange(searchQuery === "nrd" ? "" : "nrd")}
        >
          NRD ({nrdCount})
        </Button>
        <Button
          variant={searchQuery === "login" ? "primary" : "secondary"}
          size="sm"
          onClick={() => onSearchChange(searchQuery === "login" ? "" : "login")}
        >
          ログイン ({loginCount})
        </Button>
      </div>
      <DataTable
        data={filteredServices}
        rowKey={(s) => s.domain}
        rowHighlight={(s) => s.nrdResult?.isNRD === true}
        emptyMessage="検出されたサービスはありません"
        columns={[
          {
            key: "domain",
            header: "ドメイン",
            render: (s) => <code style={{ fontSize: "12px" }}>{s.domain}</code>,
          },
          {
            key: "login",
            header: "ログイン",
            width: "80px",
            render: (s) =>
              s.hasLoginPage ? <Badge variant="warning">検出</Badge> : "-",
          },
          {
            key: "privacy",
            header: "プライバシーポリシー",
            width: "160px",
            render: (s) =>
              s.privacyPolicyUrl ? (
                <a
                  href={s.privacyPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  {truncate(s.privacyPolicyUrl, 25)}
                </a>
              ) : (
                "-"
              ),
          },
          {
            key: "tos",
            header: "利用規約",
            width: "140px",
            render: (s) =>
              s.termsOfServiceUrl ? (
                <a
                  href={s.termsOfServiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.link}
                >
                  {truncate(s.termsOfServiceUrl, 20)}
                </a>
              ) : (
                "-"
              ),
          },
          {
            key: "nrd",
            header: "NRD",
            width: "100px",
            render: (s) =>
              s.nrdResult?.isNRD ? <Badge variant="danger">NRD</Badge> : "-",
          },
          {
            key: "detected",
            header: "検出日時",
            width: "140px",
            render: (s) => new Date(s.detectedAt).toLocaleDateString("ja-JP"),
          },
        ]}
      />
    </div>
  );
}
