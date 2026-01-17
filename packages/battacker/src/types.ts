export type AttackCategory =
  | "network"
  | "phishing"
  | "client-side"
  | "download"
  | "persistence"
  | "side-channel";

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
  network: 0.25,
  phishing: 0.15,
  "client-side": 0.2,
  download: 0.15,
  persistence: 0.15,
  "side-channel": 0.1,
};

export const CATEGORY_LABELS: Record<AttackCategory, string> = {
  network: "Network Attacks",
  phishing: "Phishing Attacks",
  "client-side": "Client-Side Attacks",
  download: "Download Attacks",
  persistence: "Persistence Attacks",
  "side-channel": "Side-Channel Attacks",
};

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
