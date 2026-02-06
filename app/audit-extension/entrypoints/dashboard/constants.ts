import type { Period, TabType } from "./types";

export const periodOptions: { value: Period; label: string }[] = [
  { value: "1h", label: "1時間" },
  { value: "24h", label: "24時間" },
  { value: "7d", label: "7日" },
  { value: "30d", label: "30日" },
  { value: "all", label: "全期間" },
];

export const tabs: { id: TabType; label: string }[] = [
  { id: "overview", label: "概要" },
  { id: "violations", label: "CSP違反" },
  { id: "domains", label: "ドメイン" },
  { id: "ai", label: "AI監視" },
  { id: "services", label: "サービス" },
  { id: "network", label: "ネットワーク" },
  { id: "events", label: "イベント" },
  { id: "extensions", label: "拡張機能" },
];

export const loadingTabs: { id: TabType; label: string }[] = [
  { id: "overview", label: "概要" },
  { id: "violations", label: "CSP違反" },
  { id: "domains", label: "ドメイン" },
  { id: "ai", label: "AI監視" },
];

export const validTabs: TabType[] = [
  "overview",
  "violations",
  "network",
  "domains",
  "ai",
  "services",
  "events",
  "extensions",
];

export const shortcutTabs: TabType[] = [
  "overview",
  "violations",
  "domains",
  "ai",
  "services",
  "network",
  "events",
  "extensions",
];
