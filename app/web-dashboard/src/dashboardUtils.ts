export type Period = "1h" | "24h" | "7d" | "30d" | "all";
const MAX_VALID_DATE_MS = 8.64e15;

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
    case "all":
      return MAX_VALID_DATE_MS;
    default: {
      const exhaustiveCheck: never = period;
      throw new Error(`Unexpected period: ${exhaustiveCheck}`);
    }
  }
}
