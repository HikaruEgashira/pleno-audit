export type AttackCategory =
  | "network"
  | "phishing"
  | "client-side"
  | "download"
  | "persistence"
  | "side-channel"
  | "fingerprinting"
  | "cryptojacking"
  | "privacy"
  | "media"
  | "storage"
  | "worker"
  | "injection"
  | "covert"
  | "advanced"
  | "final";

export type Severity = "critical" | "high" | "medium" | "low";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface AttackResult {
  blocked: boolean;
  detected: boolean;
  executionTime: number;
  details: string;
  error?: string;
}

export interface AttackTest {
  id: string;
  name: string;
  category: AttackCategory;
  description: string;
  severity: Severity;
  simulate: () => Promise<AttackResult>;
}

export interface TestResult {
  test: Omit<AttackTest, "simulate">;
  result: AttackResult;
  timestamp: number;
}

export interface CategoryScore {
  category: AttackCategory;
  score: number;
  maxScore: number;
  testResults: TestResult[];
}

export interface DefenseScore {
  totalScore: number;
  maxScore: number;
  grade: Grade;
  categories: CategoryScore[];
  testedAt: number;
}

export interface StoredTestHistory {
  results: DefenseScore[];
  lastTestedAt: number;
}

export const CATEGORY_WEIGHTS: Record<AttackCategory, number> = {
  network: 0.09,
  phishing: 0.05,
  "client-side": 0.09,
  download: 0.05,
  persistence: 0.05,
  "side-channel": 0.04,
  fingerprinting: 0.07,
  cryptojacking: 0.05,
  privacy: 0.05,
  media: 0.07,
  storage: 0.04,
  worker: 0.07,
  injection: 0.05,
  covert: 0.09,
  advanced: 0.07,
  final: 0.06,
};

export const CATEGORY_LABELS: Record<AttackCategory, string> = {
  network: "Network Attacks",
  phishing: "Phishing Attacks",
  "client-side": "Client-Side Attacks",
  download: "Download Attacks",
  persistence: "Persistence Attacks",
  "side-channel": "Side-Channel Attacks",
  fingerprinting: "Fingerprinting Attacks",
  cryptojacking: "Cryptojacking Attacks",
  privacy: "Privacy Attacks",
  media: "Media Capture Attacks",
  storage: "Storage Attacks",
  worker: "Worker Attacks",
  injection: "Injection Attacks",
  covert: "Covert Channel Attacks",
  advanced: "Advanced Exploitation",
  final: "Final Frontier Attacks",
};

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
