import { createLogger } from "@pleno-audit/extension-runtime";
import { allAttacks } from "../lib/attacks";
import { calculateDefenseScore, runAllTests } from "../lib/scorer";
import type { DefenseScore } from "../lib/types";

const logger = createLogger("battacker");

interface MessageRequest {
  type: "RUN_TESTS" | "GET_LAST_RESULT" | "GET_HISTORY";
}

let lastResult: DefenseScore | null = null;
let isRunning = false;

export default defineBackground(() => {
  logger.info("Background started");

  chrome.runtime.onMessage.addListener(
    (
      message: MessageRequest,
      _sender: chrome.runtime.MessageSender,
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

        default:
          sendResponse({ error: "Unknown message type" });
          return false;
      }
    },
  );
});

async function handleRunTests(): Promise<DefenseScore | { error: string }> {
  if (isRunning) {
    return { error: "Tests are already running" };
  }

  isRunning = true;
  logger.info("Starting security tests...");

  try {
    const results = await runAllTests(allAttacks, (completed, total, current) => {
      logger.debug(`Progress: ${completed}/${total} - ${current.name}`);
    });

    const score = calculateDefenseScore(results);
    lastResult = score;

    await saveResult(score);

    logger.info(`Tests complete. Score: ${score.totalScore} (${score.grade})`);

    return score;
  } catch (error) {
    logger.error("Test error:", error);
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
