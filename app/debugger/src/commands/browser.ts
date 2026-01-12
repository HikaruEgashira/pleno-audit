import { Command } from "commander";
import { writeFileSync } from "node:fs";
import {
  connectCDP,
  navigate,
  screenshot,
  click,
  evaluate,
  getAccessibilityTree,
  getTitle,
  getUrl,
} from "../cdp-client.js";

export const browserCommand = new Command("browser").description(
  "Browser automation via CDP"
);

browserCommand
  .command("open <url>")
  .description("Navigate to URL")
  .action(async (url: string) => {
    try {
      const conn = await connectCDP();
      await navigate(conn, url);
      const title = await getTitle(conn);
      console.log(`\x1b[32m✓\x1b[0m \x1b[1m${title}\x1b[0m`);
      console.log(`\x1b[2m  ${url}\x1b[0m`);
      await conn.close();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      console.error("Is Chrome running with --remote-debugging-port=9333?");
      process.exit(1);
    }
  });

browserCommand
  .command("screenshot [path]")
  .description("Take screenshot")
  .action(async (path?: string) => {
    try {
      const conn = await connectCDP();
      const data = await screenshot(conn);
      const filename = path || `screenshot-${Date.now()}.png`;
      writeFileSync(filename, Buffer.from(data, "base64"));
      console.log(`\x1b[32m✓\x1b[0m Screenshot saved: ${filename}`);
      await conn.close();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

browserCommand
  .command("click <selector>")
  .description("Click element by CSS selector")
  .action(async (selector: string) => {
    try {
      const conn = await connectCDP();
      await click(conn, selector);
      console.log(`\x1b[32m✓\x1b[0m Clicked: ${selector}`);
      await conn.close();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

browserCommand
  .command("eval <js>")
  .description("Evaluate JavaScript")
  .action(async (js: string) => {
    try {
      const conn = await connectCDP();
      const result = await evaluate(conn, js);
      console.log(result);
      await conn.close();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

browserCommand
  .command("snapshot")
  .description("Get accessibility tree (for AI)")
  .option("-p, --pretty", "Pretty print JSON")
  .action(async (options: { pretty?: boolean }) => {
    try {
      const conn = await connectCDP();
      const tree = await getAccessibilityTree(conn);
      if (options.pretty) {
        console.log(JSON.stringify(tree, null, 2));
      } else {
        console.log(JSON.stringify(tree));
      }
      await conn.close();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

browserCommand
  .command("status")
  .description("Get current page info")
  .action(async () => {
    try {
      const conn = await connectCDP();
      const title = await getTitle(conn);
      const url = await getUrl(conn);
      console.log(`Title: ${title}`);
      console.log(`URL: ${url}`);
      await conn.close();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      console.error("Is Chrome running with --remote-debugging-port=9333?");
      process.exit(1);
    }
  });
