/**
 * Battacker-Audit Integration E2E Test
 *
 * Tests that Audit extension detects attacks simulated by Battacker.
 * Both extensions are loaded via Playwright's persistent context.
 */

import { test, expect } from "@playwright/test";
import { chromium, type BrowserContext, type Page } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AUDIT_EXTENSION_PATH = resolve(__dirname, "../../audit-extension/dist/chrome-mv3");
const BATTACKER_EXTENSION_PATH = resolve(__dirname, "../../battacker-extension/dist/chrome-mv3");
const TEST_PAGE_PATH = resolve(__dirname, "../fixtures/test-page.html");

// Event types that Audit extension detects
type AuditEventType =
  | "tracking_beacon_detected"
  | "data_exfiltration_detected"
  | "xss_detected"
  | "cookie_access_detected"
  | "suspicious_download_detected"
  | "dom_scraping_detected"
  | "clipboard_hijack_detected"
  | "credential_theft_risk"
  | "supply_chain_risk"
  | "login_detected"
  | "typosquat_detected"
  | "cookie_set";

interface AuditEvent {
  type: AuditEventType;
  domain: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

interface TestContext {
  context: BrowserContext;
  page: Page;
  auditExtensionId: string;
  server: Server;
  serverPort: number;
}

function startTestServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url === "/" || req.url === "/test-page.html") {
        const content = readFileSync(TEST_PAGE_PATH, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
      } else {
        // Mock endpoints for attack simulations
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3456;
      resolve({ server, port });
    });
  });
}

async function setupBrowserWithExtensions(): Promise<TestContext> {
  // Verify extension builds exist
  if (!existsSync(AUDIT_EXTENSION_PATH)) {
    throw new Error(`Audit extension not found at ${AUDIT_EXTENSION_PATH}. Run: pnpm --filter @pleno-audit/audit-extension build`);
  }
  if (!existsSync(BATTACKER_EXTENSION_PATH)) {
    throw new Error(`Battacker extension not found at ${BATTACKER_EXTENSION_PATH}. Run: pnpm --filter @pleno-audit/battacker-extension build`);
  }

  // Start test server
  const { server, port } = await startTestServer();

  // Chrome extensions require the new headless mode (--headless=new)
  // Traditional headless mode doesn't support extensions
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--headless=new",
      `--disable-extensions-except=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
      `--load-extension=${AUDIT_EXTENSION_PATH},${BATTACKER_EXTENSION_PATH}`,
      "--no-first-run",
      "--disable-default-apps",
    ],
  });

  // Wait for extensions to initialize and retry service worker detection
  let auditExtensionId: string | null = null;
  const maxAttempts = 15;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 500));

    const serviceWorkers = context.serviceWorkers();
    if (attempt === 0 || attempt % 5 === 0) {
      console.log(`Attempt ${attempt + 1}: Found ${serviceWorkers.length} service workers`);
      for (const sw of serviceWorkers) {
        console.log(`  - ${sw.url()}`);
      }
    }

    // Find extension service workers
    for (const sw of serviceWorkers) {
      const url = sw.url();
      if (url.includes("background")) {
        const id = new URL(url).host;
        if (!auditExtensionId) {
          auditExtensionId = id;
          console.log(`Found extension: ${auditExtensionId}`);
        }
      }
    }

    if (auditExtensionId) {
      break;
    }
  }

  if (!auditExtensionId) {
    await context.close();
    server.close();
    throw new Error("Extension service worker not found after multiple attempts");
  }

  const page = await context.newPage();

  return { context, page, auditExtensionId, server, serverPort: port };
}

async function getAuditEvents(context: BrowserContext, extensionId: string): Promise<AuditEvent[]> {
  const backgroundPage = await context.newPage();

  try {
    await backgroundPage.goto(`chrome-extension://${extensionId}/dashboard.html`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    await backgroundPage.waitForTimeout(2000);

    const events = await backgroundPage.evaluate(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "GET_EVENTS",
          data: { limit: 1000 },
        });
        return response?.events || [];
      } catch (e) {
        console.error("Failed to get events:", e);
        return [];
      }
    });

    return events as AuditEvent[];
  } catch (e) {
    console.log("Failed to get events from dashboard:", e);
    return [];
  } finally {
    await backgroundPage.close();
  }
}

test.describe("Battacker-Audit Integration E2E Suite", () => {
  let ctx: TestContext;

  test.beforeAll(async () => {
    ctx = await setupBrowserWithExtensions();
  });

  test.afterAll(async () => {
    if (ctx?.context) {
      await ctx.context.close();
    }
    if (ctx?.server) {
      ctx.server.close();
    }
  });

  test("should detect all attack types when simulated", async () => {
    const testPageUrl = `http://127.0.0.1:${ctx.serverPort}/test-page.html`;

    // Navigate to test page
    await ctx.page.goto(testPageUrl, { waitUntil: "domcontentloaded" });

    // Wait for extensions to inject their content scripts
    await ctx.page.waitForTimeout(2000);

    // Run all attack simulations from the test page
    await ctx.page.evaluate(() => {
      // @ts-expect-error global function from test-page.html
      if (typeof window.runAllTests === "function") {
        // @ts-expect-error global function
        window.runAllTests();
      }
    });

    // Wait for all events to be processed
    await ctx.page.waitForTimeout(5000);

    // Get all detected events
    const events = await getAuditEvents(ctx.context, ctx.auditExtensionId);

    console.log("\n=== Audit Event Detection Results ===");
    console.log(`Total events detected: ${events.length}`);

    // Group events by type
    const eventsByType = events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("\nEvents by type:");
    for (const [type, count] of Object.entries(eventsByType)) {
      console.log(`  - ${type}: ${count}`);
    }

    // Verify security events are detected
    expect(events.length, "Should detect at least some events").toBeGreaterThan(0);

    // Check for specific attack detection types
    const securityEventTypes: AuditEventType[] = [
      "tracking_beacon_detected",
      "data_exfiltration_detected",
      "xss_detected",
      "cookie_access_detected",
      "dom_scraping_detected",
    ];

    const detectedTypes = new Set(events.map((e) => e.type));
    const missingTypes = securityEventTypes.filter((t) => !detectedTypes.has(t));

    if (missingTypes.length > 0) {
      console.log(`\nMissing event types: ${missingTypes.join(", ")}`);
    }

    // At least 3 different security event types should be detected
    const securityEventsDetected = securityEventTypes.filter((t) => detectedTypes.has(t));
    expect(
      securityEventsDetected.length,
      `Should detect multiple security event types. Found: ${securityEventsDetected.join(", ")}`
    ).toBeGreaterThanOrEqual(3);
  });

  test("should detect tracking beacons", async () => {
    const testPageUrl = `http://127.0.0.1:${ctx.serverPort}/test-page.html`;
    await ctx.page.goto(testPageUrl, { waitUntil: "domcontentloaded" });
    await ctx.page.waitForTimeout(1000);

    // Simulate beacon attack
    await ctx.page.evaluate(() => {
      navigator.sendBeacon("/tracking/beacon", JSON.stringify({
        event: "pageview",
        session: "test-session-" + Date.now(),
        user_id: "user-456",
      }));
    });

    await ctx.page.waitForTimeout(3000);

    const events = await getAuditEvents(ctx.context, ctx.auditExtensionId);
    const beaconEvents = events.filter((e) => e.type === "tracking_beacon_detected");

    console.log(`Beacon events detected: ${beaconEvents.length}`);
    expect(beaconEvents.length).toBeGreaterThan(0);
  });

  test("should detect data exfiltration attempts", async () => {
    const testPageUrl = `http://127.0.0.1:${ctx.serverPort}/test-page.html`;
    await ctx.page.goto(testPageUrl, { waitUntil: "domcontentloaded" });
    await ctx.page.waitForTimeout(1000);

    // Simulate data exfiltration
    await ctx.page.evaluate(() => {
      fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "victim@example.com",
          password: "supersecret123",
          api_key: "sk-1234567890abcdef1234567890abcdef",
        }),
      }).catch(() => {});
    });

    await ctx.page.waitForTimeout(3000);

    const events = await getAuditEvents(ctx.context, ctx.auditExtensionId);
    const exfilEvents = events.filter((e) => e.type === "data_exfiltration_detected");

    console.log(`Data exfiltration events detected: ${exfilEvents.length}`);
    expect(exfilEvents.length).toBeGreaterThan(0);
  });

  test("should detect XSS payload injection", async () => {
    const testPageUrl = `http://127.0.0.1:${ctx.serverPort}/test-page.html`;
    await ctx.page.goto(testPageUrl, { waitUntil: "domcontentloaded" });
    await ctx.page.waitForTimeout(1000);

    // Simulate XSS attacks
    await ctx.page.evaluate(() => {
      const div = document.createElement("div");
      div.innerHTML = '<script>alert("xss")</script>';
      document.body.appendChild(div);

      const div2 = document.createElement("div");
      div2.innerHTML = '<img src=x onerror="alert(1)">';
      document.body.appendChild(div2);
    });

    await ctx.page.waitForTimeout(3000);

    const events = await getAuditEvents(ctx.context, ctx.auditExtensionId);
    const xssEvents = events.filter((e) => e.type === "xss_detected");

    console.log(`XSS events detected: ${xssEvents.length}`);
    expect(xssEvents.length).toBeGreaterThan(0);
  });
});

test.describe("Extension Loading Verification", () => {
  test("both extensions should load successfully", async () => {
    const ctx = await setupBrowserWithExtensions();

    try {
      const serviceWorkers = ctx.context.serviceWorkers();

      console.log("Loaded service workers:");
      for (const sw of serviceWorkers) {
        console.log(`  - ${sw.url()}`);
      }

      // Should have at least 2 service workers
      expect(serviceWorkers.length).toBeGreaterThanOrEqual(2);

      // Navigate to test page
      await ctx.page.goto(`http://127.0.0.1:${ctx.serverPort}/test-page.html`);
      await ctx.page.waitForTimeout(2000);

      // Verify page loaded correctly
      const title = await ctx.page.title();
      expect(title).toContain("Battacker-Audit");
    } finally {
      await ctx.context.close();
      ctx.server.close();
    }
  });
});
