import { Command } from "commander";
import { spawn, execSync } from "node:child_process";
import { resolve } from "node:path";

const DEBUG_PORT = "9223";

export const devCommand = new Command("dev")
  .description("Chrome extension development commands");

devCommand
  .command("start")
  .description("Start development environment with headless Chrome")
  .option("--headless", "Run Chrome in headless mode")
  .option("--no-cleanup", "Skip cleanup on exit")
  .action(async (options) => {
    process.env.DEBUG_PORT = DEBUG_PORT;

    const rootDir = resolve(import.meta.dirname, "../../../..");

    console.log("[dev] Building pleno-battacker...");
    execSync("pnpm -C app/pleno-battacker build", {
      cwd: rootDir,
      stdio: "inherit",
      env: { ...process.env, DEBUG_PORT }
    });

    console.log(`[dev] Starting dev environment on port ${DEBUG_PORT}...`);
    if (options.headless) {
      console.log("[dev] Running in headless mode");
    }

    const concurrently = spawn("npx", [
      "concurrently",
      "--kill-others",
      "-n", "debug,ext,logs",
      "-c", "blue,green,yellow",
      "pnpm -C app/debugger start server",
      "sleep 2 && pnpm -C app/extension dev",
      "sleep 2 && pnpm -C app/debugger start logs"
    ], {
      cwd: rootDir,
      stdio: "inherit",
      env: { ...process.env, DEBUG_PORT }
    });

    const cleanup = async () => {
      if (options.cleanup !== false) {
        console.log("\n[dev] Cleaning up...");
        try {
          // Send SIGTERM first
          execSync("pkill -15 -f tmp-web-ext", { stdio: "ignore" });
        } catch {
          // No processes to kill
        }
        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          // Force kill remaining
          execSync("pkill -9 -f tmp-web-ext", { stdio: "ignore" });
        } catch {
          // No processes to kill
        }
        console.log("[dev] Cleanup complete");
      }
      process.exit(0);
    };

    process.on("SIGINT", () => { cleanup(); });
    process.on("SIGTERM", () => { cleanup(); });

    concurrently.on("close", () => {
      cleanup();
    });
  });

devCommand
  .command("stop")
  .description("Stop all development Chrome processes")
  .action(() => {
    console.log("[dev] Stopping development Chrome processes...");
    try {
      execSync("pkill -15 -f tmp-web-ext 2>/dev/null || true");
      console.log("[dev] Sent SIGTERM to Chrome processes");
      execSync("sleep 2");
      execSync("pkill -9 -f tmp-web-ext 2>/dev/null || true");
      console.log("[dev] Cleanup complete");
    } catch {
      console.log("[dev] No processes to stop");
    }
  });

devCommand
  .command("status")
  .description("Check development environment status")
  .action(() => {
    try {
      const result = execSync("pgrep -f tmp-web-ext 2>/dev/null | wc -l", { encoding: "utf-8" }).trim();
      const count = parseInt(result, 10);
      if (count > 0) {
        console.log(`Chrome dev processes: ${count} running`);
        execSync("ps aux | grep tmp-web-ext | grep -v grep | head -3", { stdio: "inherit" });
      } else {
        console.log("Chrome dev processes: none");
      }
    } catch {
      console.log("Chrome dev processes: none");
    }
  });
