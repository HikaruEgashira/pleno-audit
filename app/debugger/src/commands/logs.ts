import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";
import type { LogEntry, LogLevel } from "../types.js";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};

const RESET = "\x1b[0m";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Sanitize log message to prevent log injection attacks
 * Removes control characters and ANSI escape sequences from untrusted input
 */
function sanitizeLogMessage(message: string): string {
  // Remove ANSI escape sequences and control characters except newlines
  // eslint-disable-next-line no-control-regex
  return message.replace(/[\x00-\x09\x0b-\x1f\x7f]|\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

function formatLog(entry: LogEntry, useColor: boolean): string {
  const time = new Date(entry.timestamp).toISOString().slice(11, 23);
  const level = entry.level.toUpperCase().padEnd(5);
  const color = useColor ? LEVEL_COLORS[entry.level] : "";
  const reset = useColor ? RESET : "";

  // Sanitize module and message to prevent log injection
  const safeModule = sanitizeLogMessage(entry.module);
  const safeMessage = sanitizeLogMessage(entry.message);

  return `${color}[${time}] ${level} [${safeModule}] ${safeMessage}${reset}`;
}

function shouldShowLog(
  entry: LogEntry,
  minLevel: LogLevel,
  moduleFilter?: string
): boolean {
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[minLevel]) {
    return false;
  }

  if (moduleFilter && !entry.module.includes(moduleFilter)) {
    return false;
  }

  return true;
}

export const logsCommand = new Command("logs")
  .description("Stream logs from extension in real-time")
  .option("-l, --level <level>", "Minimum log level (debug|info|warn|error)", "debug")
  .option("-m, --module <module>", "Filter by module name")
  .option("--no-color", "Disable colored output")
  .action(async (options) => {
    const minLevel = (options.level as LogLevel) || "debug";
    const moduleFilter = options.module as string | undefined;
    const useColor = options.color !== false;

    console.log("Streaming logs (Ctrl+C to stop)...\n");

    if (moduleFilter) {
      console.log(`Filtering by module: ${moduleFilter}`);
    }
    console.log(`Minimum level: ${minLevel}\n`);

    try {
      const client = await getExtensionClient();

      // Handle incoming log messages
      client.on("message", (response: { type?: string; data?: unknown }) => {
        if (response.type === "DEBUG_LOG") {
          const entry = response.data as LogEntry;
          if (shouldShowLog(entry, minLevel, moduleFilter)) {
            console.log(formatLog(entry, useColor));
          }
        }
      });

      // Keep process alive
      process.on("SIGINT", () => {
        console.log("\nStopping log stream...");
        client.disconnect();
        process.exit(0);
      });

      // Wait forever
      await new Promise(() => {});
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });
