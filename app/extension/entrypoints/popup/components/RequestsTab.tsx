import type { CSPViolation, NetworkRequest } from "@pleno-audit/csp";
import { ViolationList } from "./ViolationList";
import { NetworkList } from "./NetworkList";
import { PolicyGenerator } from "./PolicyGenerator";
import { CSPSettings } from "./CSPSettings";
import { usePopupStyles } from "../styles";

interface RequestsTabProps {
  violations: CSPViolation[];
  networkRequests: NetworkRequest[];
}

export function RequestsTab({ violations, networkRequests }: RequestsTabProps) {
  const styles = usePopupStyles();
  const hasData = violations.length > 0 || networkRequests.length > 0;

  return (
    <div>
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
        <div style={styles.divider}>
          <NetworkList requests={networkRequests} />
        </div>
      )}

      {hasData && (
        <div style={styles.divider}>
          <PolicyGenerator violations={violations} />
        </div>
      )}

      <div style={styles.divider}>
        <CSPSettings />
      </div>
    </div>
  );
}
