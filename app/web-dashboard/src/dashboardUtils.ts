export type Period = "1h" | "24h" | "7d" | "30d" | "all";

export function truncate(str: string, len: number): string {
  return str && str.length > len ? `${str.substring(0, len)}...` : str || "";
}

export function getPeriodMs(period: Period): number {
  switch (period) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}
