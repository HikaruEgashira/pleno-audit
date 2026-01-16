import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import type { DoHRequestRecord } from "@pleno-audit/extension-runtime";
import { ViolationList } from "./ViolationList";
import { NetworkList } from "./NetworkList";
import { DoHList } from "./DoHList";
import { PolicyGenerator } from "./PolicyGenerator";
import { CSPSettings } from "./CSPSettings";
import { usePopupStyles } from "../styles";

interface RequestsTabProps {
  violations: CSPViolation[];
  networkRequests: NetworkRequest[];
  doHRequests: DoHRequestRecord[];
}

export function RequestsTab({ violations, networkRequests, doHRequests }: RequestsTabProps) {
  const styles = usePopupStyles();
  const hasData = violations.length > 0 || networkRequests.length > 0 || doHRequests.length > 0;

  return (
    <div style={styles.tabContent}>
      {!hasData && (
        <div style={styles.section}>
          <p style={styles.emptyText}>
            CSP違反・ネットワークリクエストはまだ検出されていません
          </p>
        </div>
      )}

      {violations.length > 0 && (
        <div>
          <ViolationList violations={violations} />
        </div>
      )}

      {networkRequests.length > 0 && (
        <div>
          <NetworkList requests={networkRequests} />
        </div>
      )}

      {doHRequests.length > 0 && (
        <div>
          <DoHList requests={doHRequests} />
        </div>
      )}

      {hasData && (
        <div>
          <PolicyGenerator violations={violations} />
        </div>
      )}

      <div>
        <CSPSettings />
      </div>
    </div>
  );
}
