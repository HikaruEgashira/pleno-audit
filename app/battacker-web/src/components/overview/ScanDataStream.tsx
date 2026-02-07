import { motion } from "framer-motion";

export function ScanDataStream({ progress, phase }: { progress: number; phase: string }) {
  const dataLines = [
    `[${String(progress).padStart(3, "0")}%] SCANNING DEFENSE LAYER...`,
    `> VECTOR: ${phase}`,
    `> PACKETS: ${Math.floor(progress * 12.7)}`,
    `> LATENCY: ${(Math.random() * 50 + 10).toFixed(1)}ms`,
  ];

  return (
    <motion.div
      className="scan-data-stream"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="stream-header">
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          ▶ LIVE TELEMETRY
        </motion.span>
      </div>
      <div className="stream-content">
        {dataLines.map((line, i) => (
          <motion.div
            key={`${line}-${i}`}
            className="stream-line"
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
