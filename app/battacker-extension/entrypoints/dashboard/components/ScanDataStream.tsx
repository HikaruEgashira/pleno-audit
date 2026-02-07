import { motion } from "motion/react";
import type { ScanState } from "../types";

export function ScanDataStream({ scanState }: { scanState: ScanState }) {
  const progress = scanState.total > 0 ? Math.round((scanState.completed / scanState.total) * 100) : 0;
  const currentCategory = scanState.currentTest?.category?.toUpperCase() || "INIT";
  const currentTest = scanState.currentTest?.name || "Initializing...";

  const dataLines = [
    `[${String(scanState.completed).padStart(3, "0")}/${scanState.total || "?"}] SCANNING DEFENSE LAYER...`,
    `> CATEGORY: ${currentCategory}`,
    `> TEST: ${currentTest}`,
    `> PROGRESS: ${progress}%`,
  ];

  return (
    <motion.div
      class="scan-data-stream"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div class="stream-header">
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          ▶ LIVE TELEMETRY
        </motion.span>
      </div>
      <div class="stream-content">
        {dataLines.map((line, i) => (
          <motion.div
            key={`${line}-${i}`}
            class="stream-line"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: [0.4, 1, 0.4], x: 0 }}
            transition={{
              opacity: { duration: 1.5, repeat: Infinity, delay: i * 0.2 },
              x: { duration: 0.3 },
            }}
          >
            {line}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
