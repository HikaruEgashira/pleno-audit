import type { DefenseScore, StoredTestHistory } from "../types";

export interface BattackerStorage {
  getLastResult(): Promise<DefenseScore | null>;
  saveResult(result: DefenseScore): Promise<void>;
  getHistory(): Promise<DefenseScore[]>;
  clearHistory(): Promise<void>;
}
