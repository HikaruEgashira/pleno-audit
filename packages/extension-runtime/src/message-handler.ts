/**
 * メッセージハンドラーの共通ユーティリティ
 */

type HandlerFn<TData, TResult> = (
  data: TData,
  sender: chrome.runtime.MessageSender
) => Promise<TResult>;

type ErrorResponse = { success: false; reason: string };

interface HandlerConfig<TData, TResult> {
  handler: HandlerFn<TData, TResult>;
  errorResponse: TResult | ErrorResponse;
  logPrefix?: string;
}

const LOG_PREFIX = "[Pleno Audit]";

export function createMessageRouter() {
  const handlers = new Map<
    string,
    {
      handler: HandlerFn<unknown, unknown>;
      errorResponse: unknown;
      logPrefix: string;
    }
  >();

  function register<TData, TResult>(
    type: string,
    config: HandlerConfig<TData, TResult>
  ) {
    handlers.set(type, {
      handler: config.handler as HandlerFn<unknown, unknown>,
      errorResponse: config.errorResponse,
      logPrefix: config.logPrefix ?? type,
    });
  }

  function listen() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const config = handlers.get(message.type);
      if (!config) {
        return true;
      }

      const data = message.data ?? message.payload;

      config
        .handler(data, sender)
        .then(sendResponse)
        .catch((error) => {
          console.error(
            `${LOG_PREFIX} Error handling ${config.logPrefix}:`,
            error
          );
          sendResponse(config.errorResponse);
        });

      return true;
    });
  }

  return { register, listen };
}

export function fireAndForget<T>(
  promise: Promise<T>,
  context: string
): void {
  promise.catch((error) => {
    console.error(`${LOG_PREFIX} Error in ${context}:`, error);
  });
}
