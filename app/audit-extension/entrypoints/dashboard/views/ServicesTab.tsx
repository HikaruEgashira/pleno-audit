import type { DetectedService } from "@pleno-audit/detectors";
import { Badge, Button, DataTable, SearchInput } from "../../../components";
import type { DashboardStyles } from "../styles";
import { truncate } from "../utils";

interface ServicesTabProps {
  styles: DashboardStyles;
  services: DetectedService[];
  nrdServices: DetectedService[];
  loginServices: DetectedService[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export function ServicesTab({
  styles,
  services,
  nrdServices,
  loginServices,
  searchQuery,
  setSearchQuery,
}: ServicesTabProps) {
  return (
    <div style={styles.section}>
      <div style={styles.filterBar}>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="ドメインで検索..." />
        <Button
          variant={searchQuery === "nrd" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setSearchQuery(searchQuery === "nrd" ? "" : "nrd")}
        >
          NRD ({nrdServices.length})
        </Button>
        <Button
          variant={searchQuery === "login" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setSearchQuery(searchQuery === "login" ? "" : "login")}
        >
          ログイン ({loginServices.length})
        </Button>
      </div>
      <DataTable
        data={services}
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
            render: (s) => (s.hasLoginPage ? <Badge variant="warning">検出</Badge> : "-"),
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
            render: (s) => (s.nrdResult?.isNRD ? <Badge variant="danger">NRD</Badge> : "-"),
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
