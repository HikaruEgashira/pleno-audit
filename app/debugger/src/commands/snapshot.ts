import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const snapshotCommand = new Command("snapshot")
  .description("Get full extension state snapshot as JSON")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_SNAPSHOT");

      if (response.success) {
        const output = options.pretty
          ? JSON.stringify(response.data, null, 2)
          : JSON.stringify(response.data);
        console.log(output);
      } else {
        console.error(`Error: ${response.error}`);
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
