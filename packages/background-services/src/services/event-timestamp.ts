interface TimestampLogger {
  warn?: (...args: unknown[]) => void;
}

interface ResolveTimestampOptions {
  fallback?: number;
  logger?: TimestampLogger;
  context?: string;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function resolveEventTimestamp(
  value: unknown,
  options?: ResolveTimestampOptions,
): number {
  const resolved = parseTimestamp(value);
  if (resolved !== null) {
    return resolved;
  }

  const fallback = options?.fallback ?? Date.now();
  options?.logger?.warn?.("Event timestamp fallback to ingest time.", {
    context: options?.context || "unknown",
    inputType: typeof value,
    fallback,
  });
  return fallback;
}
