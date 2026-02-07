import type { Logger } from "@pleno-audit/extension-runtime";
import { getParquetStore } from "./parquet.js";
import type { DebugHandlerResult } from "./types.js";

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export async function getEvents(
  logger: Logger,
  params: { limit?: number; type?: string }
): Promise<DebugHandlerResult> {
  try {
    const store = await getParquetStore();
    const result = await store.getEvents({
      limit: params.limit ?? 100,
      type: params.type,
    });

    const events = result.data.map((event) => ({
      id: event.id,
      type: event.type,
      domain: event.domain,
      timestamp: event.timestamp,
      details: typeof event.details === "string" ? safeJsonParse(event.details) : event.details,
    }));

    return {
      success: true,
      data: events,
    };
  } catch (error) {
    logger.error("getEvents error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get events",
    };
  }
}

export async function getEventsCount(logger: Logger): Promise<DebugHandlerResult> {
  try {
    const store = await getParquetStore();
    const result = await store.getEvents({ limit: 0 });

    return {
      success: true,
      data: result.total,
    };
  } catch (error) {
    logger.error("getEventsCount error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get events count",
    };
  }
}

export async function clearEvents(logger: Logger): Promise<DebugHandlerResult> {
  try {
    const store = await getParquetStore();
    await store.clearAll();

    return {
      success: true,
    };
  } catch (error) {
    logger.error("clearEvents error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear events",
    };
  }
}
