import type { ScanState } from "../types";
import { CyberGauge } from "./CyberGauge";

export function InitialState({
  running,
  loading,
  scanState,
  onScan,
}: {
  running: boolean;
  loading: boolean;
  scanState: ScanState;
  onScan: () => void;
}) {
  const scanValue = running
    ? scanState.total > 0
      ? Math.round((scanState.completed / scanState.total) * 100)
      : 0
    : 0;

  return (
    <div class="initial-state">
      <div class="score-card initial">
        <CyberGauge
          value={scanValue}
          grade=""
          isScanning={running}
          isLoading={loading}
          scanState={running ? scanState : undefined}
          onClick={running || loading ? undefined : onScan}
        />
        <div class="score-meta">
          {running ? "Scanning in progress..." : "Ready to execute security scan"}
        </div>
      </div>
    </div>
  );
}
