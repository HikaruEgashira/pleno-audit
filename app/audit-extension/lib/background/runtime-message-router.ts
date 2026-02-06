import type {
  LoggerLike,
  RuntimeMessage,
  RuntimeMessageHandlers,
} from "./runtime-handlers/types";
import type { runAsyncMessageHandler } from "./runtime-handlers/async-runner";

interface RuntimeMessageRouterDeps {
  logger: LoggerLike;
  handlers: RuntimeMessageHandlers;
  runAsyncMessageHandler: typeof runAsyncMessageHandler;
}

export function registerRuntimeMessageRouter(
  deps: RuntimeMessageRouterDeps
): void {
  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = rawMessage as RuntimeMessage;
    const type = typeof message.type === "string" ? message.type : "";

    if (!type) {
      deps.logger.warn("Unknown message type:", message.type);
      return false;
    }

    const directHandler = deps.handlers.direct.get(type);
    if (directHandler) {
      return directHandler(message, sender, sendResponse);
    }

    const asyncHandler = deps.handlers.async.get(type);
    if (asyncHandler) {
      return deps.runAsyncMessageHandler(
        deps.logger,
        asyncHandler,
        message,
        sender,
        sendResponse
      );
    }

    deps.logger.warn("Unknown message type:", type);
    return false;
  });
}
