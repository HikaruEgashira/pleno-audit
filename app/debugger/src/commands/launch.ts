import { Command } from "commander";
import { spawn, ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { getDebugServer, waitForExtension } from "../server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find extension dist directory (prefer dev build for debug-bridge)
function findExtensionDir(): string {
  const candidates = [
    resolve(__dirname, "../../../extension/dist/chrome-mv3-dev"),
    resolve(__dirname, "../../../../app/extension/dist/chrome-mv3-dev"),
    resolve(__dirname, "../../../extension/dist/chrome-mv3"),
    resolve(__dirname, "../../../../app/extension/dist/chrome-mv3"),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }

  throw new Error(
    "Extension dist not found. Run `pnpm --filter @pleno-audit/extension dev` first to build with debug-bridge."
  );
}

let chromeProcess: ChildProcess | null = null;

export const launchCommand = new Command("launch")
  .description("Launch Chrome with extension, CDP, and debug server")
  .option("-p, --port <port>", "CDP port", "9333")
  .option("-d, --debug-port <port>", "Debug server port", "9222")
  .option("-u, --url <url>", "URL to open on launch")
  .option("--no-wait", "Don't wait for extension to connect")
  .action(
    async (options: {
      port: string;
      debugPort: string;
      url?: string;
      wait: boolean;
    }) => {
      try {
        // 1. Start debug server
        console.log("Starting debug server on port 9222...");
        const server = getDebugServer();

        // 2. Find extension
        const extensionDir = findExtensionDir();
        console.log(`Extension: ${extensionDir}`);

        // 3. Launch Chrome
        const chromePath =
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

        const args = [
          `--remote-debugging-port=${options.port}`,
          `--load-extension=${extensionDir}`,
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-timer-throttling",
          `--user-data-dir=/tmp/pleno-debug-chrome-${Date.now()}`,
        ];

        // Open blank page first
        args.push("about:blank");

        console.log(`Starting Chrome with CDP on port ${options.port}...`);

        chromeProcess = spawn(chromePath, args, {
          detached: false,
          stdio: "ignore",
        });

        chromeProcess.on("exit", (code) => {
          console.log(`Chrome exited with code ${code}`);
          server.close();
          process.exit(0);
        });

        // 4. Wait for extension to connect
        if (options.wait) {
          console.log("Waiting for extension to connect...");
          try {
            await waitForExtension(15000);
            console.log("\x1b[32m✓\x1b[0m Extension connected!");
          } catch {
            console.error(
              "\x1b[33m⚠\x1b[0m Extension did not connect (debug-bridge may not be enabled)"
            );
          }
        }

        // 5. Navigate to URL if specified
        if (options.url) {
          // Use CDP to navigate
          const CDP = await import("chrome-remote-interface");
          const client = await CDP.default({ port: parseInt(options.port) });
          const { Page } = client;
          await Page.enable();
          await Page.navigate({ url: options.url });
          await Page.loadEventFired();
          console.log(`\x1b[32m✓\x1b[0m Opened: ${options.url}`);
          await client.close();

          // Wait a bit for extension to detect services
          await new Promise((r) => setTimeout(r, 2000));
        }

        console.log("");
        console.log("\x1b[32m✓\x1b[0m Ready!");
        console.log(`CDP endpoint: http://localhost:${options.port}`);
        console.log(`Debug server: ws://localhost:9222`);
        console.log("");
        console.log("Commands:");
        console.log("  pleno-debug browser open <url>    Navigate to URL");
        console.log("  pleno-debug browser screenshot    Take screenshot");
        console.log("  pleno-debug services list         Show detected services");
        console.log("");
        console.log("Press Ctrl+C to stop");

        // Keep process running
        process.on("SIGINT", () => {
          console.log("\nShutting down...");
          if (chromeProcess) {
            chromeProcess.kill();
          }
          server.close();
          process.exit(0);
        });
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        process.exit(1);
      }
    }
  );
