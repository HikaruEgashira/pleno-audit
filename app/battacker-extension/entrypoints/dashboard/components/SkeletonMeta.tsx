import { motion } from "motion/react";

export function SkeletonMeta() {
  return (
    <div class="score-meta skeleton-meta">
      <motion.div
        class="skeleton-line"
        style={{ width: "180px", height: "12px" }}
        animate={{
          backgroundPosition: ["200% 0", "-200% 0"],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
