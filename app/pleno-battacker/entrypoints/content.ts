import { createLogger } from "@pleno-audit/extension-runtime";
import {
  allAttacks,
  calculateDefenseScore,
  runAllTests,
  type DefenseScore,
} from "@pleno-audit/battacker";

const logger = createLogger("battacker-content");

interface BattackerMessage {
  type: "BATTACKER_RUN_TESTS";
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    logger.debug("Content script loaded");

    chrome.runtime.onMessage.addListener(
      (
        message: BattackerMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: DefenseScore | { error: string }) => void,
      ) => {
        if (message.type === "BATTACKER_RUN_TESTS") {
          logger.info("Running tests in page context...");
          executeTests().then(sendResponse);
          return true;
        }
        return false;
      },
    );
  },
});

async function executeTests(): Promise<DefenseScore | { error: string }> {
  try {
    logger.info(`Starting ${allAttacks.length} attack simulations...`);

    const results = await runAllTests(allAttacks, (completed, total, current) => {
      logger.debug(`Progress: ${completed}/${total} - ${current.name}`);
    });

    const score = calculateDefenseScore(results);
    logger.info(`Tests complete. Score: ${score.totalScore} (${score.grade})`);

    return score;
  } catch (error) {
    logger.error("Test execution error:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
