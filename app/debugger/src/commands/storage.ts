import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

export const storageCommand = new Command("storage")
  .description("Storage operations");

storageCommand
  .command("list")
  .description("List all storage keys")
  .action(async () => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_STORAGE_LIST");

      if (response.success) {
        const keys = response.data as string[];
        if (keys.length === 0) {
          console.log("(no keys)");
        } else {
          for (const key of keys) {
            console.log(key);
          }
        }
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

storageCommand
  .command("get <key>")
  .description("Get storage value by key")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (key: string, options) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_STORAGE_GET", { key });

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

storageCommand
  .command("set <key> <value>")
  .description("Set storage value (value should be valid JSON)")
  .action(async (key: string, value: string) => {
    try {
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Treat as string if not valid JSON
        parsedValue = value;
      }

      const client = await getExtensionClient();
      const response = await client.send("DEBUG_STORAGE_SET", {
        key,
        value: parsedValue,
      });

      if (response.success) {
        console.log(`Set ${key} = ${JSON.stringify(parsedValue)}`);
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

storageCommand
  .command("clear")
  .description("Clear all storage data")
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    if (!options.yes) {
      console.log("Use --yes to confirm clearing all storage data");
      process.exit(1);
    }

    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_STORAGE_CLEAR");

      if (response.success) {
        console.log("Storage cleared");
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
