import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const browserCommand = new Command("browser")
  .description("Browser control commands");

browserCommand
  .command("open <url>")
  .description("Open a URL in a new browser tab")
  .action(async (url: string) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_TAB_OPEN", { url });

      if (response.success) {
        console.log(`Opened: ${response.data?.url}`);
        console.log(`Tab ID: ${response.data?.tabId}`);
      } else {
        console.error(`Failed: ${response.error}`);
        process.exit(1);
      }

      client.disconnect();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

browserCommand
  .command("test-extension-request")
  .description("Send a test request to verify webRequest listener is working")
  .action(async () => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_TEST_EXTENSION_REQUEST", {});

      if (response.success) {
        console.log("Test request sent successfully!");
        console.log(`URL: ${response.data?.url}`);
        console.log(`Status: ${response.data?.status}`);
        console.log(`Extension ID: ${response.data?.extensionId}`);
        console.log("\nCheck extension_request events with:");
        console.log("  pleno-debug events list --type extension_request");
      } else {
        console.error(`Failed: ${response.error}`);
        process.exit(1);
      }

      client.disconnect();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });
