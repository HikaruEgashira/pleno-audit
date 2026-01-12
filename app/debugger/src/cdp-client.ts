/**
 * Chrome DevTools Protocol (CDP) client for browser automation.
 * Connects to Chrome's remote debugging port.
 */
import CDP from "chrome-remote-interface";

const CDP_PORT = 9333;

export interface CDPConnection {
  client: CDP.Client;
  Page: CDP.Client["Page"];
  Runtime: CDP.Client["Runtime"];
  DOM: CDP.Client["DOM"];
  Accessibility: CDP.Client["Accessibility"];
  close: () => Promise<void>;
}

/**
 * Connect to Chrome's CDP endpoint.
 */
export async function connectCDP(port = CDP_PORT): Promise<CDPConnection> {
  const client = await CDP({ port });
  const { Page, Runtime, DOM, Accessibility } = client;

  await Promise.all([Page.enable(), Runtime.enable(), DOM.enable()]);

  return {
    client,
    Page,
    Runtime,
    DOM,
    Accessibility,
    close: async () => {
      await client.close();
    },
  };
}

/**
 * Navigate to a URL.
 */
export async function navigate(
  conn: CDPConnection,
  url: string
): Promise<void> {
  await conn.Page.navigate({ url });
  await conn.Page.loadEventFired();
}

/**
 * Take a screenshot and return as base64.
 */
export async function screenshot(conn: CDPConnection): Promise<string> {
  const result = await conn.Page.captureScreenshot({ format: "png" });
  return result.data;
}

/**
 * Execute JavaScript in the page context.
 */
export async function evaluate(
  conn: CDPConnection,
  expression: string
): Promise<unknown> {
  const result = await conn.Runtime.evaluate({
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
}

/**
 * Click an element by selector.
 */
export async function click(
  conn: CDPConnection,
  selector: string
): Promise<void> {
  await evaluate(conn, `document.querySelector('${selector}')?.click()`);
}

/**
 * Get accessibility tree (for AI agent use).
 */
export async function getAccessibilityTree(
  conn: CDPConnection
): Promise<unknown> {
  await conn.Accessibility.enable();
  const { nodes } = await conn.Accessibility.getFullAXTree();
  return nodes;
}

/**
 * Get page title.
 */
export async function getTitle(conn: CDPConnection): Promise<string> {
  const result = await evaluate(conn, "document.title");
  return String(result);
}

/**
 * Get current URL.
 */
export async function getUrl(conn: CDPConnection): Promise<string> {
  const result = await evaluate(conn, "window.location.href");
  return String(result);
}
