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
  | "advanced";

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
  network: 0.1,
  phishing: 0.06,
  "client-side": 0.1,
  download: 0.06,
  persistence: 0.06,
  "side-channel": 0.05,
  fingerprinting: 0.08,
  cryptojacking: 0.06,
  privacy: 0.06,
  media: 0.08,
  storage: 0.05,
  worker: 0.08,
  injection: 0.06,
  covert: 0.1,
  advanced: 0.08,
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
};

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
