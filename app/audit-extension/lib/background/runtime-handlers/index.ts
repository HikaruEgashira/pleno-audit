import type { RuntimeHandlerDependencies, RuntimeMessageHandlers } from "./types";
import { createAsyncHandlers } from "./async-handlers";
import { createDirectHandlers } from "./direct-handlers";

export function createRuntimeMessageHandlers(
  deps: RuntimeHandlerDependencies,
): RuntimeMessageHandlers {
  return {
    direct: createDirectHandlers(deps),
    async: createAsyncHandlers(deps),
  };
}

export { runAsyncMessageHandler } from "./async-runner";
export type {
  AsyncMessageHandlerConfig,
  LoggerLike,
  RuntimeHandlerDependencies,
  RuntimeHandlerFallbacks,
  RuntimeMessage,
  RuntimeMessageHandler,
  RuntimeMessageHandlers,
} from "./types";
