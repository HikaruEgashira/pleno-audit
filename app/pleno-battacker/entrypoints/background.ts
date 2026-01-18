import { createLogger } from "@pleno-audit/extension-runtime";
import type { DefenseScore } from "@pleno-audit/battacker";

const logger = createLogger("battacker");

interface MessageRequest {
  type: "RUN_TESTS" | "GET_LAST_RESULT" | "GET_HISTORY" | "BATTACKER_CONTENT_READY";
}

// Track which tabs have content script ready
const readyTabs = new Set<number>();

let lastResult: DefenseScore | null = null;
let isRunning = false;

/**
 * Find a suitable target tab for testing.
 * When called from the dashboard (chrome-extension:// page), we need to find
 * another web page tab to run tests on.
 */
async function findTargetTab(): Promise<chrome.tabs.Tab | null> {
  // First, try to get the active tab in the current window
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = activeTabs[0];

  // If active tab is a regular web page, use it
  if (activeTab?.url && isTestableUrl(activeTab.url)) {
    logger.debug(`Using active tab: ${activeTab.url}`);
    return activeTab;
  }

  // Active tab is an internal page (like dashboard), find another suitable tab
  logger.debug("Active tab is internal page, searching for testable tab...");

  // Search all windows for a suitable tab, prioritizing the current window
  const allTabs = await chrome.tabs.query({});

  // Sort: prefer tabs in current window, then by most recently active
  const currentWindowId = activeTab?.windowId;
  const sortedTabs = allTabs
    .filter((tab) => tab.url && isTestableUrl(tab.url))
    .sort((a, b) => {
      // Prioritize current window
      if (a.windowId === currentWindowId && b.windowId !== currentWindowId) return -1;
      if (b.windowId === currentWindowId && a.windowId !== currentWindowId) return 1;
      // Then prioritize active tabs
      if (a.active && !b.active) return -1;
      if (b.active && !a.active) return 1;
      return 0;
    });

  if (sortedTabs.length > 0) {
    logger.debug(`Found testable tab: ${sortedTabs[0].url}`);
    return sortedTabs[0];
  }

  logger.warn("No testable tab found");
  return null;
}

function isTestableUrl(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://")
  );
}

export default defineBackground(() => {
  logger.info("Background started");

  chrome.runtime.onMessage.addListener(
    (
      message: MessageRequest,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      switch (message.type) {
        case "RUN_TESTS":
          handleRunTests().then(sendResponse);
          return true;

        case "GET_LAST_RESULT":
          handleGetLastResult().then(sendResponse);
          return true;

        case "GET_HISTORY":
          handleGetHistory().then(sendResponse);
          return true;

        case "BATTACKER_CONTENT_READY":
          if (sender.tab?.id) {
            readyTabs.add(sender.tab.id);
            logger.debug(`Content script ready in tab ${sender.tab.id}`);
          }
          sendResponse({ ok: true });
          return false;

        default:
          sendResponse({ error: "Unknown message type" });
          return false;
      }
    },
  );

  // Clean up readyTabs when tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    readyTabs.delete(tabId);
  });
});

async function handleRunTests(): Promise<DefenseScore | { error: string }> {
  if (isRunning) {
    return { error: "Tests are already running" };
  }

  isRunning = true;
  logger.info("Starting security tests via content script...");

  try {
    // Find a suitable target tab for testing
    const targetTab = await findTargetTab();

    if (!targetTab?.id) {
      return { error: "No suitable web page found. Please open a regular web page to test." };
    }

    const url = targetTab.url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
      return { error: "Cannot run tests on browser internal pages. Please navigate to a regular web page." };
    }

    // Check if content script is already ready (from manifest-based auto-injection)
    if (!readyTabs.has(targetTab.id)) {
      // Inject content script (needed for dev mode where content_scripts is not in manifest)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          files: ["content-scripts/content.js"],
        });
        logger.debug("Content script injected");
      } catch (injectError) {
        // Script might already be injected or page doesn't allow injection
        logger.debug("Content script injection skipped:", injectError);
      }

      // Wait for content script to signal readiness (with timeout)
      const maxWaitTime = 5000; // 5 seconds max
      const checkInterval = 100;
      let waited = 0;

      while (!readyTabs.has(targetTab.id) && waited < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      }

      if (!readyTabs.has(targetTab.id)) {
        logger.warn("Content script did not signal ready within timeout, attempting anyway...");
      }
    } else {
      logger.debug("Content script already ready");
    }

    logger.info("Sending message to content script...");

    let response: DefenseScore | { error: string };
    try {
      response = await chrome.tabs.sendMessage(targetTab.id, {
        type: "BATTACKER_RUN_TESTS",
      }) as DefenseScore | { error: string };
    } catch (sendError) {
      logger.error("sendMessage error:", sendError);
      if (sendError instanceof Error && sendError.message.includes("Receiving end does not exist")) {
        return { error: "Content script not loaded. Please refresh the page and try again." };
      }
      return { error: `Message send failed: ${sendError instanceof Error ? sendError.message : String(sendError)}` };
    }

    logger.info("Received response from content script:", response);

    if (!response) {
      return { error: "No response from content script" };
    }

    if ("error" in response) {
      logger.error("Content script returned error:", response.error);
      return response;
    }

    lastResult = response;
    await saveResult(response);

    logger.info(`Tests complete. Score: ${response.totalScore} (${response.grade})`);

    return response;
  } catch (error) {
    logger.error("Unexpected error:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  } finally {
    isRunning = false;
  }
}

async function handleGetLastResult(): Promise<DefenseScore | null> {
  if (lastResult) {
    return lastResult;
  }

  const stored = await chrome.storage.local.get("battacker_lastResult");
  return stored.battacker_lastResult ?? null;
}

async function handleGetHistory(): Promise<DefenseScore[]> {
  const stored = await chrome.storage.local.get("battacker_history");
  return stored.battacker_history ?? [];
}

async function saveResult(score: DefenseScore): Promise<void> {
  await chrome.storage.local.set({ battacker_lastResult: score });

  const historyData = await chrome.storage.local.get("battacker_history");
  const history: DefenseScore[] = historyData.battacker_history ?? [];

  history.push(score);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filteredHistory = history.filter((h) => h.testedAt > thirtyDaysAgo);

  await chrome.storage.local.set({ battacker_history: filteredHistory });
}
