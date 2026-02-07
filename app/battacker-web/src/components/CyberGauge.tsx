import { motion } from "framer-motion";
import { describeArc } from "../utils/geometry";

export function CyberGauge({
  value,
  grade,
  isScanning,
  isLoading,
  phase,
  onClick,
}: {
  value: number;
  grade: string;
  isScanning: boolean;
  isLoading?: boolean;
  phase: string;
  onClick?: () => void;
}) {
  const isInteractive = !!onClick && !isScanning && !isLoading;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  const gradeColors: Record<string, string> = {
    A: "#ffffff",
    B: "#d0d0d0",
    C: "#a0a0a0",
    D: "#707070",
    F: "#505050",
    "": "#ffffff",
  };

  const color = gradeColors[grade] || gradeColors.F;

  const handleClick = () => {
    if (!isInteractive) {
      return;
    }
    onClick();
  };

  return (
    <motion.div
      className={`score-gauge ${isInteractive ? "interactive" : ""}`}
      style={{ position: "relative", cursor: isInteractive ? "pointer" : "default" }}
      onClick={handleClick}
      whileHover={isInteractive ? { scale: 1.02 } : undefined}
      whileTap={isInteractive ? { scale: 0.98 } : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="glowLg" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="scanBeamLg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1a1a1a" strokeWidth="10" />

        {isScanning && (
          <>
            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 15}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray="12 6"
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 25}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="6 12"
              animate={{ rotate: -360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            <motion.circle
              cx={cx}
              cy={cy}
              r={radius + 35}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              animate={{
                r: [radius + 35, radius + 50, radius + 35],
                opacity: [0.08, 0.2, 0.08],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <path
                d={describeArc(cx, cy, radius, 0, 60)}
                fill="none"
                stroke="url(#scanBeamLg)"
                strokeWidth="10"
                strokeLinecap="round"
                filter="url(#glowLg)"
              />
            </motion.g>

            <motion.circle
              cx={cx}
              cy={cy}
              r={radius - 20}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="3 9"
              animate={{ rotate: -360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />

            <motion.circle
              cx={cx}
              cy={cy}
              r="4"
              fill="white"
              animate={{
                r: [4, 7, 4],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />

            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <motion.circle
                key={i}
                cx={cx + Math.cos((angle * Math.PI) / 180) * (radius - 12)}
                cy={cy + Math.sin((angle * Math.PI) / 180) * (radius - 12)}
                r="2"
                fill="white"
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.33,
                }}
              />
            ))}
          </>
        )}

        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.15, ease: "linear" }}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: `${cx}px ${cy}px`,
            filter: isScanning ? "url(#glowLg)" : "none",
          }}
        />

        {!isScanning && (
          <>
            <line x1="10" y1="10" x2="30" y2="10" stroke="#333" strokeWidth="1" />
            <line x1="10" y1="10" x2="10" y2="30" stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1="10" x2={size - 30} y2="10" stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1="10" x2={size - 10} y2="30" stroke="#333" strokeWidth="1" />
            <line x1="10" y1={size - 10} x2="30" y2={size - 10} stroke="#333" strokeWidth="1" />
            <line x1="10" y1={size - 10} x2="10" y2={size - 30} stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1={size - 10} x2={size - 30} y2={size - 10} stroke="#333" strokeWidth="1" />
            <line x1={size - 10} y1={size - 10} x2={size - 10} y2={size - 30} stroke="#333" strokeWidth="1" />
          </>
        )}
      </svg>

      <div className="score-text">
        {isScanning ? (
          <motion.div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <motion.div
              className="score-value"
              style={{ color: "#fff" }}
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              {value}
            </motion.div>
            <motion.div
              key={phase}
              className="score-grade"
              style={{ fontSize: 11 }}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {phase}
            </motion.div>
          </motion.div>
        ) : isLoading ? (
          <motion.div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <motion.div
              className="score-value"
              style={{ color: "#fff", fontSize: 28 }}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              INIT
            </motion.div>
          </motion.div>
        ) : grade ? (
          <>
            <div className={`score-value grade-${grade}`}>{value}</div>
            <div className="score-grade">Grade {grade}</div>
            {isInteractive && (
              <motion.div
                className="scan-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                TAP TO RESCAN
              </motion.div>
            )}
          </>
        ) : (
          <>
            <motion.div
              className="score-value"
              style={{ fontSize: 32 }}
              animate={isInteractive ? { opacity: [0.8, 1, 0.8] } : undefined}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Execute
            </motion.div>
            {isInteractive && (
              <motion.div
                className="scan-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                TAP TO SCAN
              </motion.div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
