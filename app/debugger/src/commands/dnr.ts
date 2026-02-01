import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

interface DNRConfig {
  enabled: boolean;
  excludeOwnExtension: boolean;
  excludedExtensions: string[];
  maxStoredRequests: number;
}

export const dnrCommand = new Command("dnr").description(
  "DNR (Extension Network Monitor) operations"
);

dnrCommand
  .command("config")
  .description("Get or set Extension Monitor config")
  .option("-e, --enabled <boolean>", "Enable/disable monitoring (true/false)")
  .option("-x, --exclude-own <boolean>", "Exclude own extension (true/false)")
  .option("-m, --max-requests <number>", "Max stored requests")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    try {
      const client = await getExtensionClient();

      const updates: Partial<DNRConfig> = {};
      if (options.enabled !== undefined) {
        updates.enabled = options.enabled === "true";
      }
      if (options.excludeOwn !== undefined) {
        updates.excludeOwnExtension = options.excludeOwn === "true";
      }
      if (options.maxRequests !== undefined) {
        updates.maxStoredRequests = parseInt(options.maxRequests, 10);
      }

      if (Object.keys(updates).length > 0) {
        const response = await client.send("DEBUG_DNR_CONFIG_SET", updates);
        if (response.success) {
          console.log("Extension Monitor config updated:");
          const config = response.data as DNRConfig;
          console.log(`  Enabled: ${config.enabled}`);
          console.log(`  Exclude own extension: ${config.excludeOwnExtension}`);
          console.log(`  Max stored requests: ${config.maxStoredRequests}`);
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
      } else {
        const response = await client.send("DEBUG_DNR_CONFIG_GET");
        if (response.success) {
          const config = response.data as DNRConfig;
          if (options.pretty) {
            console.log(JSON.stringify(config, null, 2));
          } else {
            console.log(`Enabled: ${config.enabled}`);
            console.log(`Exclude own extension: ${config.excludeOwnExtension}`);
            console.log(`Excluded extensions: ${config.excludedExtensions.length}`);
            console.log(`Max stored requests: ${config.maxStoredRequests}`);
          }
        } else {
          console.error(`Error: ${response.error}`);
          process.exit(1);
        }
      }

      client.disconnect();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });
